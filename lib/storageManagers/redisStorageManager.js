/* eslint-disable max-len */
const StorageManager = require('./storageManager.js');
const redis = require('redis');
const { promisify } = require('util');
const logger = require('tz-logger');
const path = require('path');
const { fork } = require('child_process');

/* Constants and flags */
/* The application envionment. */
// const NODE_ENV = process.env.NODE_ENV || 'development';
/* The maximum retry time in milliseconds after which retry attempts will fail. */
const MAX_RETRY_TIME = process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000;
/* The maximum retry times after which retry attempts will fail. */
const MAX_RETRY_ATTEMPTS = process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31;
/* The frequency in milliseconds with which connection retry is attempted. */
const REDIS_RETRY_FREQ = process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000;
/* The flag that allows Redis caching to be turned off. */
const REDIS_MANAGER_ON = process.env.REDIS_MANAGER_ON === 'true' || false;
// Note: Need to be modified in future because REDIS_URL env variable may be renamed!
const REDIS_URL = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';
/* Number of members deleted in bulk from a regular bucket. */
const REG_BUCKET_MEMBER_BULK_DEL_SIZE = process.env.REG_BUCKET_MEMBER_BULK_DEL_SIZE ? parseInt(process.env.REG_BUCKET_MEMBER_BULK_DEL_SIZE, 10) : 2000;
/* Number of members deleted in bulk from the Global bucket. */
const GLOBAL_BUCKET_MEMBER_BULK_DEL_SIZE = process.env.GLOBAL_BUCKET_MEMBER_BULK_DEL_SIZE ? parseInt(process.env.GLOBAL_BUCKET_MEMBER_BULK_DEL_SIZE, 10) : 2000;
/* Enables the garbage collector for RedisStorageManager */
const REDIS_GC_ON = process.env.REDIS_GC_ON === 'true' || false;

/* Private members */
// Constants
const READ_WRITE_CONN = Symbol('READ_WRITE_CONN');
const PUB_SUB_CONN = Symbol('PUB_SUB_CONN');
const garbageCollector = Symbol('garbageCollector');
// Flags
const gcRunning = Symbol('gcRunning');
// Utility methods
const init = Symbol('init');
const createConnection = Symbol('createConnection');
const nameConnection = Symbol('nameConnection');
const memorySizeOf = Symbol('memorySizeOf');
const evalDataSize = Symbol('evalDataSize');
const checkRedisAvailable = Symbol('checkRedisAvailable');
const removedKeys = Symbol('removedKeys');
const validateKey = Symbol('validateKey');
const validateBuckets = Symbol('validateBuckets');
const initGarbageCollector = Symbol('initGarbageCollector');
// Redis client async methods
const sendCommandAsync = Symbol('sendCommandAsync');
const scriptAsync = Symbol('scriptAsync');
// Redis Event listeners
const handleRedisError = Symbol('handleRedisError');
const handleRedisConnect = Symbol('handleRedisConnect');
const handleRedisMessages = Symbol('handleRedisMessages');
// RedisManager Event listeners
const handleBucketDeleted = Symbol('handleBucketDeleted');
const handleCacherError = Symbol('handleCacherError');
// Redis scripts
const getCachedValueSha1 = Symbol('getCachedValueSha1');
const setCachedValueSha1 = Symbol('setCachedValueSha1');
const purgeBucketsSha1 = Symbol('purgeBucketsSha1');
const bucketDeleteSha1 = Symbol('bucketDeleteSha1');
// GC event listeners
const handleGCMessage = Symbol('handleGCMessage');

/**
 * This is a StorageManager that uses a Redis client library to manage caching objects within a
 * Redis server. The connection to the Redis server is configured based on environment variables.
 * The `RedisStorageManager` is exposed as a Singleton.
 */
class RedisStorageManager extends StorageManager {
    /**
     * This adds a name to the connection.
     * @param {*} options
     * @param {string} options.app the name of the app.
     * @param {string} options.env the name of the environment.
     * @param {string} options.instance the name of the instance.
     */
    constructor({ app, env, instance }) {
        super({ app, env, instance });
        this.REDIS_MANAGER_ON = REDIS_MANAGER_ON;
        this.REDIS_AVAILABLE = false;
        this[gcRunning] = false;

        /* Register Redis clients */
        this[READ_WRITE_CONN] = this[createConnection]();
        this[PUB_SUB_CONN] = this[createConnection]();

        /* Promisified Redis client methods */
        this[sendCommandAsync] = promisify(this[READ_WRITE_CONN].send_command).bind(this[READ_WRITE_CONN]);
        this[scriptAsync] = promisify(this[READ_WRITE_CONN].script).bind(this[READ_WRITE_CONN]);

        /* Initialize Redis server with required configuration. */
        this[init]();

        /* Redis event subscriptions */
        this[PUB_SUB_CONN].subscribe(`${this.app}:bucket_del`); // Channel to announce the deletion of a bucket
        this[PUB_SUB_CONN].subscribe(`${this.app}:cacher_error`); // Channel to cacher errors

        /* Event handlers */
        // Redis Events
        this[READ_WRITE_CONN].on('error', this[handleRedisError].bind(this));
        this[READ_WRITE_CONN].on('connect', this[handleRedisConnect].bind(this));
        this[PUB_SUB_CONN].on('message', this[handleRedisMessages].bind(this));

        // Custom Events
        this.on('bucket.deleted', this[handleBucketDeleted].bind(this));
        this.on('cacher.error', this[handleCacherError].bind(this));
    }

    /**
     * Returns a Promise that resolves to an object saved in cache or a null value.
     * @param {string} key the Redis cache key.
     * @returns {Promise} returns a promise that resolves to a cached object.
     */
    async getCachedValue(key) {
        if (this[checkRedisAvailable]()) {
            this[validateKey](key);
            try {
                const cacheVal = await this[sendCommandAsync]('EVALSHA', [this[getCachedValueSha1], 1, key]);
                if (cacheVal) {
                    return cacheVal;
                }
                return cacheVal;
            } catch (error) {
                logger.error(error.message);
                return null;
            }
        }
        return null;
    }

    /**
     * Stringyfies the value and saves it into Redis cache as a hashed value.
     * The hash structure is as follows:
     * ```javascript
        {
            data: cachedData,
            readCount: 1,
            createDate: date,
            sourceObject: 'objectName',
            sourceMethod: 'methodName',
            ttl
        }
    ```
    * @param {*} options
    * @param {string} options.app the name of the app or library asking to purge buckets.
    * @param {string} options.env the name of the environment the applicaiton is running in.
    * @param {string} options.key the Redis cache key.
    * @param {string} options.cachedObject the object being cached.
    * @param {string} options.cachedMethod the name of the method whos value is being cached.
    * @param {*} options.value the value that needs to be strinigfied.
    * @param {number} options.ttl the TTL for the cache entry in seconds.
    * @param {Array<string>} options.buckets a list of buckets.
    * @returns {Promise} returns a promise that resolves to a status message from Redis.
    */
    async setCachedValue({ app, env, key, cachedObject, cachedMethod, value, ttl, buckets }) {
        if (this[checkRedisAvailable]()) {
            // Check the size of the value
            this[evalDataSize](value);
            this[validateKey](key);
            let cacheVal = value;
            let result; // Redis resonse.
            try {
                result = await this[sendCommandAsync]('EVALSHA', [this[setCachedValueSha1], 9,
                    key,
                    env,
                    app,
                    JSON.stringify(cacheVal || null),
                    0,
                    new Date(),
                    cachedObject,
                    cachedMethod,
                    ttl,
                    ...buckets]);
                return result;
            } catch (error) {
                logger.log(error.message);
                return null;
            }
        }
        return null;
    }

    /**
     * Invalidates the keys from the associated buckets.
     * @param {*} options
     * @param {string} options.app the name of the app or library asking to purge buckets.
     * @param {string} options.env the name of the environment the applicaiton is running in.
     * @param {Array<string>} options.buckets a list of buckets.
     * @returns {boolean} returns `true` for success, and `false` for failure.
     */
    async purgeBuckets({ app, env, buckets }) {
        if (this[checkRedisAvailable]()) {
            this[validateBuckets](buckets);
            try {
                this[sendCommandAsync]('EVALSHA', [this[purgeBucketsSha1], 2, env, app, ...buckets]);
                return true; // Indicates success.
            } catch (error) {
                logger.log(error.message);
                return false; // Indicates failure.
            }
        }
        return false;
    }

    /* PRIVATE METHODS */

    /**
     * Initializes the Redis server
     * @private
     */
    async [init]() {
        try {
            logger.info('Initializing Redis...');
            // Initialize a list of removed keys
            this[removedKeys] = [];
            /* Enable keyspace events. */
            // await this[configAsync]('SET', 'notify-keyspace-events', 'Ex');
            // Load Get cached value script
            this[getCachedValueSha1] = await this[scriptAsync]('load', `
            redis.replicate_commands();
            --print('- getCachedValueSha1 -----------------------------');
            -- Set the local variables
            local key = KEYS[1];
            -- Get the value
            local keyExists = redis.call('EXISTS', key);
            local cacheVal;
            local ttl;
            local cachedData;
            if keyExists == 1 then
                -- Increase the read count
                redis.call('HINCRBY', key, 'readCount', 1);
                cacheVal = redis.call('HGETALL', key);
                for key, val in pairs(cacheVal) do
                    if (val == 'data') then
                        cachedData = cacheVal[key + 1]; -- Grab the next value for the data and end loop.
                    end;
                    if (val == 'ttl') then
                        ttl = cacheVal[key + 1]; -- Grab the next value for the ttl and end loop.
                    end;
                end;
                -- Refresh the expiration
                redis.call('EXPIRE', key, ttl);
                -- Return the cached value
                return cachedData;
            end;
            return nil;`);

            // Load Set cached value script
            this[setCachedValueSha1] = await this[scriptAsync]('load', `
            redis.replicate_commands();
            -- print('- setCachedValueSha1 -----------------------------');
            -- Set local variables
            local key = KEYS[1];
            local NODE_ENV = KEYS[2];
            local APP_NAME = KEYS[3];
            local globalBucket = 'BUCKET.' .. NODE_ENV .. '.' .. APP_NAME .. '.GLOBAL';
            local cacheVal = KEYS[4];
            local readCount = tonumber(KEYS[5]);
            local createDate = KEYS[6];
            local sourceObject = KEYS[7];
            local sourceMethod = KEYS[8];
            local ttl = tonumber(KEYS[9]);
            -- local buckets = {};
            local buckets = ARGV;
            local result;

            -- Helper Functions --
            ----------------------

            --- Returns the full name of a bucket.
            -- Format: BUCKET.{env}.{app}.{bucket}
            -- @param myBucket
            local normalizeBucketNames = function(myBuckets)
                -- print('- normalizeBucketNames -----------------------------');
                local normalizedList = {};
                for i, bucket in pairs(myBuckets) do
                    local bucketAppNameTable = {}; -- pair(app, bucket)
                    for curr in string.gmatch(bucket, '[^%.]+') do
                        table.insert(bucketAppNameTable, curr);
                    end;
                    if (table.getn(bucketAppNameTable) > 1) then
                        table.insert(normalizedList, bucket);
                    else
                        table.insert(normalizedList, APP_NAME .. '.' .. bucket);
                        --return (APP_NAME .. '.' .. bucket);
                    end;
                end;
                return normalizedList;
            end;

            --- Set the cached value with the specified key
            -- @param key
            -- @param cacheVal
            -- @param createDate
            -- @param sourceObject
            -- @param sourceMethod
            -- @param ttl
            local saveCachedVal = function(key, cacheVal, createDate, 
                                            sourceObject, sourceMethod, ttl)
                -- Set the cached value with the specified key
                redis.call('HMSET', key, 
                            'data', cacheVal, 
                            'readCount', 0, 
                            'createDate', tostring(createDate), 
                            'sourceObject', tostring(sourceObject), 
                            'sourceMethod', tostring(sourceMethod), 
                            'ttl', ttl);
                -- Set the expiration
                redis.call('EXPIRE', key, ttl);
            end;

            --- Saves the key and associated buckets into the GLOBAL bucket
            -- @param key
            -- @param bucket
            local saveKeyToGlobalBucket = function(key, buckets)
                print('- saveKeyToGlobalBucket -----------------------------');
                local globalKey = {};
                globalKey['key'] = key;
                globalKey['buckets'] = buckets;
                local storedGlobalKey = cjson.encode(globalKey);
                redis.call('SADD', globalBucket, storedGlobalKey);
            end;

            --- Save key to individual buckets
            -- @param key
            -- @param bucket
            local saveKeyToBuckets = function(key, buckets)
                for i, bucket in pairs(buckets) do
                    -- Find the app and bucket name
                    local bucketAppNameTable = {}; -- pair(app, bucket)
                    for curr in string.gmatch(bucket, '[^%.]+') do
                        table.insert(bucketAppNameTable, curr);
                    end;
                    local bucketApp = '';
                    local bucketName = '';
                    if (table.getn(bucketAppNameTable) > 1) then
                        bucketApp = bucketAppNameTable[1];
                        bucketName = bucketAppNameTable[2];
                        if (bucketApp == APP_NAME) then
                            redis.call('SADD', 'BUCKET.' .. NODE_ENV .. '.' .. bucketApp .. '.' .. bucketName, key);
                        else
                            -- Find the buckets associated with the other app
                            result = redis.call('KEYS', 'BUCKET.' .. NODE_ENV .. '.' .. bucketApp .. '.' .. bucketName);
                            for x, otherAppBucket in pairs(result) do
                                redis.call('SADD', otherAppBucket, key);
                            end;
                        end;
                    else
                        -- No App specified for bucket
                        redis.call('SADD', 'BUCKET.' .. NODE_ENV .. '.' .. APP_NAME .. '.' .. bucket, key);
                    end;
                end;
            end;

            buckets = normalizeBucketNames(buckets);
            -- Set the cached value with the specified key
            saveCachedVal(key, cacheVal, createDate, sourceObject, sourceMethod, ttl);
            -- Save key to GLOBAL bucket
            saveKeyToGlobalBucket(key, buckets);
            -- Save key to individual buckets
            saveKeyToBuckets(key, buckets);
            return 1;`);

            // Load bucket purge script
            this[purgeBucketsSha1] = await this[scriptAsync]('load', `
            redis.replicate_commands();
            print('- purgeBucketsSha1 -----------------------------');
            local startTime = redis.call('TIME');
            local startSec = startTime[1] % 1000;
            local startMs = startTime[2];
            local totalStartMs = startMs + (startSec * 1000 * 1000);

            local NODE_ENV = KEYS[1];
            local APP_NAME = KEYS[2];
            local globalBucket = 'BUCKET.' .. NODE_ENV .. '.' .. APP_NAME .. '.GLOBAL';
            local buckets = ARGV;
            local bucket;
            local bucketMembers;
            local deletedMembers = {};
            local result = 0;

            -- Helper Functions --
            ----------------------

            --- Returns the full name of a bucket.
            -- Format: BUCKET.{env}.{app}.{bucket}
            -- @param myBucket
            local normalizeBucketNames = function(myBuckets)
                -- print('- normalizeBucketNames -----------------------------');
                local normalizedList = {};
                for i, bucket in pairs(myBuckets) do
                    local bucketAppNameTable = {}; -- pair(app, bucket)
                    for curr in string.gmatch(bucket, '[^%.]+') do
                        table.insert(bucketAppNameTable, curr);
                    end;
                    if (table.getn(bucketAppNameTable) > 1) then
                        table.insert(normalizedList, bucket);
                    else
                        table.insert(normalizedList, APP_NAME .. '.' .. bucket);
                        --return (APP_NAME .. '.' .. bucket);
                    end;
                end;
                return normalizedList;
            end;

            --- Purges the keys from a bucket
            -- @param myBucket
            local deleteBucketMembersFn = function(myBucket)
                -- print('- deleteBucketMembersFn -----------------------------');
                bucketMembers = redis.call('SMEMBERS', myBucket);
                -- If GLOBAL bucket, then just skip
                if (globalBucket == myBucket) then
                    return 1;
                end;
                for i = 1, table.getn(bucketMembers), 1 do
                    table.insert(deletedMembers, bucketMembers[i]);
                    if table.getn(deletedMembers) >= ${REG_BUCKET_MEMBER_BULK_DEL_SIZE} then
                        redis.call('DEL', unpack(deletedMembers));
                        deletedMembers = {};
                    end;
                end;
                -- Delete the remaining keys
                if table.getn(deletedMembers) > 0 then
                    redis.call('DEL', unpack(deletedMembers));
                end;
                -- Now delete the bucket
                result = redis.call('DEL', myBucket);
                if result == 1 then
                    redis.call('PUBLISH', "${this.app}:bucket_del", myBucket);
                end;
            end;

            --- Finds the buckets assocuated with the pattern and remmoves it's members.
            -- @param bucketApp the application assocuated with the bucket
            -- @param bucket the bucket pattern
            local findBucketsAndDeleteMembers = function(bucketApp, bucket)
                result = redis.call('KEYS', 'BUCKET.' .. NODE_ENV .. '.' .. bucketApp .. '.' .. bucket);
                for x, currAppBucket in pairs(result) do
                    deleteBucketMembersFn(currAppBucket);
                end;
            end;
            
            -- If the bucket is present, clean the buckets
            if buckets ~= nil then
                buckets = normalizeBucketNames(buckets);
                for key, bucket in pairs(buckets) do
                    -- Find the app and bucket name
                    local bucketAppNameTable = {}; -- pair(app, bucket)
                    for curr in string.gmatch(bucket, '[^%.]+') do
                        table.insert(bucketAppNameTable, curr);
                    end;
                    local bucketApp = '';
                    local bucketName = '';
                    if (table.getn(bucketAppNameTable) > 1) then
                        bucketApp = bucketAppNameTable[1];
                        bucketName = bucketAppNameTable[2];
                        -- print('App: ' .. bucketApp .. ', Bucket: ' .. bucketName);
                        if (bucketApp == APP_NAME) then
                            -- Find the buckets associated with the other app
                            findBucketsAndDeleteMembers(bucketApp, bucketName);
                        else
                            print('WARNING: Cannot purge bucket of a different app.');
                            redis.call('PUBLISH', "${this.app}:cacher_error", 'WARNING: Cannot purge bucket of a different app.');
                        end;
                    else
                        -- No App specified for bucket
                        -- Find the buckets associated with the other app
                        findBucketsAndDeleteMembers(APP_NAME, bucket);
                    end;
                    -- If all buckets cleared, just return
                    if (bucket == '*') then
                        return 1;
                    end;
                end;
            end;

            local endTime = redis.call('TIME');
            local endSec = endTime[1] % 1000;
            local endMs = endTime[2];
            local totalEndMs = endMs + (endSec * 1000 * 1000);
            --print(string.format("elapsed time: %.3fs", (totalEndMs - totalStartMs) / 1000000));
            return 1;`);

            // Bucket delete script
            this[bucketDeleteSha1] = await this[scriptAsync]('load', `
            redis.replicate_commands();
            print('- bucketDeleteSha1 -----------------------------');
            local startTime = redis.call('TIME');
            local startSec = startTime[1] % 1000;
            local startMs = startTime[2];
            local totalStartMs = startMs + (startSec * 1000 * 1000);

            local removedBucket = KEYS[1];
            local bucketAppNameTable = {}; -- table('BUCKET', env, app, bucket)
            for curr in string.gmatch(removedBucket, '[^%.]+') do
                table.insert(bucketAppNameTable, curr);
            end;
            local NODE_ENV = bucketAppNameTable[2];
            local APP_NAME = bucketAppNameTable[3];
            local bucketName = bucketAppNameTable[4];
            local removedBucketShort = APP_NAME .. '.' .. bucketName;
            local globalBucket = 'BUCKET.' .. NODE_ENV .. '.' .. APP_NAME .. '.GLOBAL';

            local cursor = 0;
            local result = 0;
            local count = 0;

            -- If GLOBAL bucket does not exist, return
            result = redis.call('EXISTS', globalBucket);
            if (result < 0) then
                -- print(globalBucket .. ' does not exist!');
                return 1;
            end;
                
            count = redis.call('SCARD', globalBucket);
            -- If no elements in GLOBAL bucket, remove it, and return
            if (count == 0) then
                -- remove GLOBAL bucket
                result = redis.call('DEL', globalBucket);
                return 1;
            end;

            -- Remove Items from individual bucket.
            local pattern = '*' .. removedBucketShort .. '*';
            local members = redis.call('SSCAN', globalBucket, cursor, 'MATCH', pattern, 'COUNT', count + 1);
            local bucketMembers = members[2];
            local deletedMembers = {};
            local deletedMember = '';
            result = 0;
            for i = 1, table.getn(bucketMembers), 1 do
                deletedMember = bucketMembers[i];
                table.insert(deletedMembers, deletedMember);
                if table.getn(deletedMembers) >= ${GLOBAL_BUCKET_MEMBER_BULK_DEL_SIZE} then
                    --print(unpack(deletedMembers));
                    result = result + redis.call('SREM', globalBucket, unpack(deletedMembers));
                    deletedMembers = {};
                end;
            end;
            -- Delete the remaining keys
            if table.getn(deletedMembers) > 0 then
                -- print(unpack(deletedMembers));
                result = result + redis.call('SREM', globalBucket, unpack(deletedMembers));
            end;

            local endTime = redis.call('TIME');
            local endSec = endTime[1] % 1000;
            local endMs = endTime[2];
            local totalEndMs = endMs + (endSec * 1000 * 1000);
            --print(string.format("elapsed time: %.3fs", (totalEndMs - totalStartMs) / 1000000));

            return 1;`);
        } catch (error) {
            logger.error('Unable to configure Redis.');
        }
    }

    /**
     * Returns `true` only if Redis Manager is turned on and Redis is available for caching, and `false` otherwise.
     * @returns {boolean} returns `true` when Redis is available for operation or `false` otherwise.
     * @private
     */
    [checkRedisAvailable]() {
        if (this.REDIS_MANAGER_ON && this.REDIS_AVAILABLE) {
            return true;
        }
        return false;
    }

    /**
     * Creates a Redis client connection. The client is created with a retry strategy function.
     * If you return a number from that function, the retry will happen exactly after that time
     * in milliseconds. If you return a non-number, no further retry will happen and all offline
     * commands are flushed with errors. Return an error to return that specific error to all
     * offline commands.
     * @returns {*} returns a Redis client connection.
     * @private
     */
    [createConnection]() {
        return redis.createClient({
            url: REDIS_URL,
            retry_strategy(options) {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    // End reconnecting on a specific error and flush all commands
                    logger.error('The server refused the connection!');
                }
                if (options.total_retry_time > MAX_RETRY_TIME) {
                    // End reconnecting after a specific timeout and flush all commands
                    logger.error(`Connection lost with Redis for more than ${MAX_RETRY_TIME / 1000} seconds. Retry time exhausted!`);
                    return null;
                }
                if (options.attempt > MAX_RETRY_ATTEMPTS) {
                    // End reconnecting with built in error
                    this.REDIS_AVAILABLE = false;
                    logger.error(`Maximum connection retry attempts (${MAX_RETRY_ATTEMPTS}) exhausted!`);
                    return null;
                }
                // reconnect after
                return Math.min(options.attempt * REDIS_RETRY_FREQ, MAX_RETRY_TIME);
            }
        });
    }

    /**
     * This adds a name to the connection.
     * @param {*} options
     * @param {string} options.connection the Redis connection.
     * @param {string} options.app the name of the app.
     * @param {string} options.env the name of the environment.
     * @param {string} options.ctype the connection type.
     * @param {string} options.instance the name of the instance.
     */
    async [nameConnection]({ connection, app, env, ctype, instance }) {
        const clientAsync = promisify(connection.client).bind(connection);
        await clientAsync('setname', `${app}.${env}.${ctype}.${instance}`);
        const connName = await clientAsync('getname');
        logger.log(`New R/W connection: ${connName}`);
        return connName;
    }

    /**
     * Redis error event handler.
     * @param {*} error
     * @returns {boolean} always returns `true`.
     * @private
     */
    [handleRedisError](error) {
        logger.error(error);
        if (error.syscall === 'connect' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            this.REDIS_AVAILABLE = false;
            // Stop garbage collector
            if (this[garbageCollector]) {
                logger.log('Terminating Redis Garbage Collector.');
                this[garbageCollector].kill('SIGTERM');
                this[gcRunning] = false;
            }
        }
        return true;
    }

    /**
     * Redis connection event handler.
     * @private
     */
    async [handleRedisConnect]() {
        logger.info('Redis DB connected...');
        /* Name the RW connections */
        this[nameConnection]({
            connection: this[READ_WRITE_CONN],
            app: this.app,
            env: this.env,
            ctype: 'READ_WRITE_CONN',
            instance: this.instance });
        this.REDIS_AVAILABLE = true;
        /* Setup Garbage Collection */
        this[garbageCollector] = await this[initGarbageCollector]();
        process.on('exit', () => {
            if (this[garbageCollector]) {
                logger.log('Terminating Redis Garbage Collector.');
                this[garbageCollector].kill('SIGTERM');
                this[gcRunning] = false;
            }
        });
    }

    /**
     * Initialize the garbage collector
     */
    async [initGarbageCollector]() {
        logger.log('Initializing Garbage collector for RedisStorageManager...');
        if (this[checkRedisAvailable]() && REDIS_GC_ON) {
            try {
                let args = [];
                let execArgv = [];
                let nodeArgs = {
                    env: Object.assign({}, process.env),
                    execArgv
                };
                let exPath = path.resolve(`${__dirname}/../garbageCollectors/redisGarbageCollector.js`);
                return new Promise((resolve, reject) => {
                    // Ensure that GC process does not exist
                    if (this[gcRunning]) {
                        logger.info('Garbage collector is already running.');
                        resolve(null);
                        return;
                    }
                    this.gcProcess = fork(exPath, args, nodeArgs);
                    if (this.gcProcess.constructor.name === 'ChildProcess') {
                        this.gcProcess.on('message', this[handleGCMessage].bind(this));
                        this[gcRunning] = true;
                        logger.info('Garbage collector initialization success.');
                        resolve(this.gcProcess);
                    } else {
                        this[gcRunning] = false;
                        logger.error('Garbage collector initialization failed.');
                        reject(new Error('Garbage collector initialization failed.'));
                    }
                });
            } catch (error) {
                if (error.signal === 'SIGTERM') {
                    logger.error('Process timed out.');
                }
                return null;
            }
        } else {
            logger.log('GC initialization failed, either because Redis server is not available or REDIS_GC_ON is false.');
            return null;
        }
    }

    /**
     * Redis published messages over channels.
     * @param {string} channel
     * @param {string} message
     * @returns {boolean} always returns `true`.
     * @private
     */
    async [handleRedisMessages](channel, message) {
        // Respond to messages that relate to bucket deletion channel
        switch (channel) {
            case `${this.app}:bucket_del`:
                this.emit('bucket.deleted', message);
                break;
            case `${this.app}:cacher_error`:
                this.emit('cacher.error', message);
                break;
            default:
                break;
        }
        return true;
    }

    /**
     * RedisManager bucket deletion event handler.
     * @param {string} key the name of the bucket.
     * @private
     */
    async [handleBucketDeleted](key) {
        try {
            // Queue up the key that needs to be removed
            const result = await this[sendCommandAsync]('EVALSHA', [this[bucketDeleteSha1], 1, key]);
            return result;
        } catch (error) {
            logger.log(error);
            logger.log(`Unable to remove bucket: ${key}`);
            return 0;
        }
    }

    /**
     * Handles error messages published on Redis.
     * @param {string} message
     * @private
     */
    async [handleCacherError](message) {
        logger.log(message);
    }

    /**
     * Method that emits the message that was sent by the garbage collector.
     * @param {string} message the message sent by the garbage collector.
     */
    async [handleGCMessage](message) {
        logger.log(`GC Message: ${message}`);
    }

    /**
     * This method ensures that the key being used is a javascript string.
     * @param {*} key the key being evaluated.
     * @throws Will throw and `Error` if the key is anything other than a string.
     * @private
     */
    [validateKey](key) {
        if (key === null || key === undefined || typeof key !== 'string' || key.length === 0) throw new Error('Invalid key format!');
    }

    /**
     * This method ensures that the buckets being used is a javascript array.
     * @param {*} buckets a list of buckets.
     * @throws Will throw and `Error` if buckets is anything other than an array.
     * @private
     */
    [validateBuckets](buckets) {
        if (buckets === null || buckets === undefined || buckets.constructor.name !== 'Array') throw new Error('Invalid buckets format!');
    }

    /**
     * Returns the size in memory the object would occupy.
     * @param {object} obj
     * @returns a string representation of the size of the object.
     * @private
     */
    [memorySizeOf](obj) {
        let bytes = 0;

        function sizeOf(obj) {
            if (obj !== null && obj !== undefined) {
                switch (typeof obj) {
                    case 'number':
                        bytes += 8;
                        break;
                    case 'string':
                        bytes += obj.length * 2;
                        break;
                    case 'boolean':
                        bytes += 4;
                        break;
                    case 'object':
                        let objClass = Object.prototype.toString.call(obj).slice(8, -1);
                        if (objClass === 'Object' || objClass === 'Array') {
                            for (let key in obj) {
                                if (!obj.hasOwnProperty(key)) continue;
                                sizeOf(obj[key]);
                            }
                        } else bytes += obj.toString().length * 2;
                        break;
                    default:
                        break;
                }
            }
            return bytes;
        }

        function formatByteSize(bytes) {
            if (bytes < 1024) return `bytes ${bytes}`;
            else if (bytes < 1048576) return `${(bytes / 1024).toFixed(3)} KiB`;
            else if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(3)} MiB`;
            return `${(bytes / 1073741824).toFixed(3)} GiB`;
        }
        return formatByteSize(sizeOf(obj));
    }

    /**
     * Method checks the size of the value. It displays an alert if the size exceeds 1000.
     * It also displays the size of the data when it is JSON stringified.
     * @param {*} value the value being evaluated.
     * @private
     */
    [evalDataSize](value) {
        if (value === null || value === undefined) {
            logger.warning('Saving null.');
        } else if (value instanceof Array && value.length > 1000) {
            logger.warning('Possible large object being saved.');
        } else if (typeof value === 'object' && Object.keys(value).length > 1000) {
            logger.warning('Possible large object being saved.');
        }
        // try {
        //     let size = this[memorySizeOf](JSON.stringify(value));
        //     // logger.log(`Result size: ${size}`);
        // } catch (error) {
        //     logger.log(error);
        // }
    }
}

/**
 * Perform cleanup here because the process is about to terminate.
 */
process.on('unhandledRejection', (reason, promise) => {
    logger.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    logger.log(error.message);
});

module.exports = RedisStorageManager;
