/* eslint-disable max-len */
const StorageManager = require('./storageManager.js');
const redis = require('redis');
const { promisify } = require('util');
const logger = require('tz-logger');
const _ = require('lodash');

/* Constants and flags */
// const APP_NAME = process.env.APP_NAME || 'tz-cacher';
// /* The application envionment. */
// const APP_ENV = process.env.NODE_ENV || 'development';
/* The maximum retry time in milliseconds after which retry attempts will fail. */
const MAX_RETRY_TIME = process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000;
/* The maximum retry times after which retry attempts will fail. */
const MAX_RETRY_ATTEMPTS = process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31;
/* The frequency in milliseconds with which connection retry is attempted. */
const REDIS_RETRY_FREQ = process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000;
/* The flag that allows Redis caching to be turned off. */
const REDIS_MANAGER_ON = process.env.REDIS_MANAGER_ON === 'true' || false;
// Note: Need to be modified in future because REDIS_URL env variable may be renamed!
const REDIS_URL = process.env.REDISCLOUD_URL || process.env.REDIS_URL || 'redis://localhost:6379';
/* Number of members deleted in bulk from a regular bucket. */
const REG_BUCKET_MEMBER_BULK_DEL_SIZE = process.env.REG_BUCKET_MEMBER_BULK_DEL_SIZE || '2000';
/* Number of members deleted in bulk from the Global bucket. */
const GLOBAL_BUCKET_MEMBER_BULK_DEL_SIZE = process.env.GLOBAL_BUCKET_MEMBER_BULK_DEL_SIZE || '2000';

/* Private members */
// Constants
const READ_WRITE_CONN = Symbol('READ_WRITE_CONN');
const PUB_SUB_CONN = Symbol('PUB_SUB_CONN');

// Utility methods
const init = Symbol('init');
const createConnection = Symbol('createConnection');
const memorySizeOf = Symbol('memorySizeOf');
const evalDataSize = Symbol('evalDataSize');
const checkRedisAvailable = Symbol('checkRedisAvailable');
const removeKey = Symbol('removeKey');
const removedKeys = Symbol('removedKeys');
const purgeKeys = Symbol('purgeKeys');
const validateKey = Symbol('validateKey');
const validateBuckets = Symbol('validateBuckets');
// Redis client async methods
const configAsync = Symbol('configAsync');
const sendCommandAsync = Symbol('sendCommandAsync');
const scriptAsync = Symbol('scriptAsync');
const evalshaAsync = Symbol('evalshaAsync');
// Redis Event listeners
const handleRedisError = Symbol('handleRedisError');
const handleRedisConnect = Symbol('handleRedisConnect');
const handleRedisPmessages = Symbol('handleRedisPmessages');
const handleRedisMessages = Symbol('handleRedisMessages');
// RedisManager Event listeners
const handleKeyExpired = Symbol('handleKeyExpired');
const handleBucketDeleted = Symbol('handleBucketDeleted');
// Redis scripts
const getCachedValueSha1 = Symbol('getCachedValueSha1');
const setCachedValueSha1 = Symbol('setCachedValueSha1');
const purgeBucketsSha1 = Symbol('purgeBucketsSha1');
const removeKeySha1 = Symbol('removeKeySha1');
const bucketDeleteSha1 = Symbol('bucketDeleteSha1');

/**
 * This is a StorageManager that uses a Redis client library to manage caching objects within a
 * Redis server. The connection to the Redis server is configured based on environment variables.
 * The `RedisStorageManager` is exposed as a Singleton.
 * @param {string} options.app the name of the application.
 * @param {string} options.env the name of the environment the application is executing in.
 */
class RedisStorageManager extends StorageManager {
    constructor() {
        super();
        this.REDIS_MANAGER_ON = REDIS_MANAGER_ON;
        this.REDIS_AVAILABLE = false;
        this.BUCKET_PREFIX = `BUCKET-${this.APP_NAME}-${this.APP_ENV}`;

        /* Register Redis clients */
        this[READ_WRITE_CONN] = this[createConnection]();
        this[PUB_SUB_CONN] = this[createConnection]();

        /* Promisified Redis client methods */
        this[configAsync] = promisify(this[READ_WRITE_CONN].config).bind(this[READ_WRITE_CONN]);
        this[sendCommandAsync] = promisify(this[READ_WRITE_CONN].send_command).bind(this[READ_WRITE_CONN]);
        this[scriptAsync] = promisify(this[READ_WRITE_CONN].script).bind(this[READ_WRITE_CONN]);
        this[evalshaAsync] = promisify(this[READ_WRITE_CONN].evalsha).bind(this[READ_WRITE_CONN]);

        /* Initialize Redis server with required configuration. */
        this[init]();

        /* Redis event subscriptions */
        this[PUB_SUB_CONN].subscribe(`${APP_NAME}_${APP_ENV}_bucket_del`); // Channel to announce the deletion of a bucket

        /* Event handlers */
        // Redis Events
        this[READ_WRITE_CONN].on('error', this[handleRedisError].bind(this));
        this[READ_WRITE_CONN].on('connect', this[handleRedisConnect].bind(this));
        this[PUB_SUB_CONN].on('pmessage', this[handleRedisPmessages].bind(this));
        this[PUB_SUB_CONN].on('message', this[handleRedisMessages].bind(this));
        // Custom Events
        this.on('key.expired', this[handleKeyExpired].bind(this));
        this.on('bucket.deleted', this[handleBucketDeleted].bind(this));
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
                logger.log(error.message);
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
    * @param {string} options.cachedObject the object being cached.
    * @param {string} options.cachedMethod the name of the method whos value is being cached.
    * @param {string} options.key the Redis cache key.
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
                result = await this[sendCommandAsync]('EVALSHA', [this[setCachedValueSha1], 1,
                    key,
                    this.BUCKET_PREFIX,
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
     * @param {Array<string>} buckets a list of buckets.
     * @returns {boolean} returns `true` for success, and `false` for failure.
     */
    async purgeBuckets(buckets) {
        if (this[checkRedisAvailable]()) {
            this[validateBuckets](buckets);
            this[checkRedisAvailable]();
            try {
                this[sendCommandAsync]('EVALSHA', [this[purgeBucketsSha1], 1, this.BUCKET_PREFIX, ...buckets]);
                // logger.log(`Deleting from buckets: ${buckets}`);
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
            await this[configAsync]('SET', 'notify-keyspace-events', 'Ex');
            // Load Get cached value script
            this[getCachedValueSha1] = await this[scriptAsync]('load', `
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
            --print('- setCachedValueSha1 -----------------------------');
            -- Set local variables
            local key = KEYS[1];
            local BUCKET_PREFIX = ARGV[1];
            local globalBucket = BUCKET_PREFIX .. '-GLOBAL';
            local cacheVal = ARGV[2];
            local readCount = tonumber(ARGV[3]);
            local createDate = ARGV[4];
            local sourceObject = ARGV[5];
            local sourceMethod = ARGV[6];
            local ttl = tonumber(ARGV[7]);
            local buckets = {};
            local result;
            local BUCKET_NAMES_START = 8;
            for i = BUCKET_NAMES_START, table.getn(ARGV) , 1 do
                table.insert(buckets, ARGV[i]);
            end;
            -- Set the cached value with the specified key
            redis.call('HMSET', key, 'data', cacheVal, 'readCount', readCount, 'createDate', tostring(createDate), 'sourceObject', tostring(sourceObject), 'sourceMethod', tostring(sourceMethod), 'ttl', ttl);
            -- Set the expiration
            redis.call('EXPIRE', key, ttl);
            -- Save key to GLOBAL bucket
            local globalKey = {};
            globalKey['key'] = key;
            globalKey['buckets'] = buckets;
            local storedGlobalKey = cjson.encode(globalKey);
            redis.call('SADD', globalBucket, storedGlobalKey);
            -- Save key to individual buckets
            for i, bucket in pairs(buckets) do
                -- Find the app and bucket name
                redis.call('SADD', BUCKET_PREFIX .. '-' .. bucket, key);
            end;
            return 'OK';`);

            // Load bucket purge script
            this[purgeBucketsSha1] = await this[scriptAsync]('load', `
            --print('- purgeBucketsSha1 -----------------------------');
            local startTime = redis.call('TIME');
            local startSec = startTime[1] % 1000;
            local startMs = startTime[2];
            local totalStartMs = startMs + (startSec * 1000 * 1000);

            --for k,v in pairs(ARGV) do print(v) end;
            local BUCKET_PREFIX = KEYS[1];
            local globalBucket = BUCKET_PREFIX .. '-GLOBAL';
            local buckets = ARGV;
            local pattern;
            local bucket;
            local bucketMembers;
            local removedKey = '';
            local removedKeyList = '';
            local cursor, count = 0, 1;
            local globalBucketMember;
            local globalBucketEntry;
            local deletedMembers = {};
            local result = 0;
            count = redis.call('SCARD', globalBucket);
            -- If the bucket is present, clean the buckets
            if buckets ~= nil then
                for key, value in pairs(buckets) do
                    bucket = BUCKET_PREFIX .. '-' .. value;
                    bucketMembers = redis.call('SMEMBERS', bucket);
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
                    result = redis.call('DEL', bucket);
                    if result == 1 then
                        redis.call('PUBLISH', "${this.APP_NAME}_${this.APP_ENV}_bucket_del", bucket);
                    end;
                end;
            end;

            local endTime = redis.call('TIME');
            local endSec = endTime[1] % 1000;
            local endMs = endTime[2];
            local totalEndMs = endMs + (endSec * 1000 * 1000);
            --print(string.format("elapsed time: %.3fs", (totalEndMs - totalStartMs) / 1000000));
            return 1;`);
            // Load remove key script
            this[removeKeySha1] = await this[scriptAsync]('load', `
            --print('- removeKeySha1 -----------------------------');
            local BUCKET_PREFIX = KEYS[1];
            local cursor, count = 0, 1;
            count = KEYS[2];
            local globalBucket = BUCKET_PREFIX .. '-GLOBAL';
            local removedKeys = ARGV;
            local removedKey = '';
            local result = 0;
            for k, v in pairs(removedKeys) do
                removedKey = v;
                local pattern = '*' .. removedKey .. '*';
                local members = redis.call('SSCAN', globalBucket, cursor, 'MATCH', pattern, 'COUNT', count + 1);
                local val = members[2][1];
                local entry;
                local purgedBuckets;
                local bucketExists;
                local currBucket;
                if (val ~= nil) then
                    entry = cjson.decode(val);
                    -- Get list of buckets
                    for k,v in pairs(entry) do 
                        if k == 'buckets' then purgedBuckets = v end;
                    end;
                    -- Delete key from the bucket
                    for k,bucket in pairs(purgedBuckets) do 
                        -- Ensure bucket exists
                        currBucket = BUCKET_PREFIX .. '-' .. bucket;
                        bucketExists = redis.call('EXISTS', currBucket);
                        if bucketExists == 1 then
                            redis.call('SREM', currBucket, removedKey);
                        end;
                    end;
                end;
                
                -- Finally remove from GLOBAL bucket
                count = redis.call('SCARD', globalBucket);
                print(count);
                if count == 1 then
                    -- remove GLOBAL bucket
                    result = redis.call('DEL', globalBucket);
                    redis.call('PUBLISH', "${this.APP_NAME}_${this.APP_ENV}_bucket_del", globalBucket);
                else
                    result = redis.call('SREM', globalBucket, cjson.encode(entry));
                end;
            end;
            return 1;`);
            // Bucket delete script
            this[bucketDeleteSha1] = await this[scriptAsync]('load', `
            --print('- bucketDeleteSha1 -----------------------------');
            local startTime = redis.call('TIME');
            local startSec = startTime[1] % 1000;
            local startMs = startTime[2];
            local totalStartMs = startMs + (startSec * 1000 * 1000);

            local BUCKET_PREFIX = ARGV[1];
            local globalBucket = BUCKET_PREFIX .. '-GLOBAL';
            local removedBucket = KEYS[1];
            --print(string.format("Removing bucket: %s", removedBucket));
            -- No need to do anything when the GLOBAL bucket itself is being removed.
            --if (removedBucket == 'GLOBAL') then
            --    return 1;
            --end;
            local cursor = 0;
            local result = 0;
            local count = 0;

            -- If GLOBAL bucket does not exist, return
            result = redis.call('EXISTS', globalBucket);
            if (result < 0) then
                return 1;
            end;
                
            count = redis.call('SCARD', globalBucket);
            -- If no elements, return
            if (count == 0) then
                --print('Remove GLOBAL bucket. ', globalBucket);
                -- remove GLOBAL bucket
                result = redis.call('DEL', globalBucket);
                redis.call('PUBLISH', "${this.APP_NAME}_${this.APP_ENV}_bucket_del", globalBucket);
                return 1;
            end;

            local pattern = '*' .. removedBucket .. '*';
            local members = redis.call('SSCAN', globalBucket, cursor, 'MATCH', pattern, 'COUNT', count + 1);
            local bucketMembers = members[2];
            --print(string.format("# of items: %02d", table.getn(bucketMembers)));
            local deletedMembers = {};
            local deletedMember = '';
            for i = 1, table.getn(bucketMembers), 1 do
                deletedMember = bucketMembers[i];
                table.insert(deletedMembers, deletedMember);
                if table.getn(deletedMembers) >= ${GLOBAL_BUCKET_MEMBER_BULK_DEL_SIZE} then
                    result = result + redis.call('SREM', globalBucket, unpack(deletedMembers));
                    deletedMembers = {};
                end;
            end;
            -- Delete the remaining keys
            if table.getn(deletedMembers) > 0 then
                result = result + redis.call('SREM', globalBucket, unpack(deletedMembers));
            end;

            --print(string.format("# of items deleted: %02d", result));
            
            result = redis.call('EXISTS', globalBucket);
            if (result == 0) then
                result = redis.call('DEL', globalBucket);
                redis.call('PUBLISH', "${this.APP_NAME}_${this.APP_ENV}_bucket_del", globalBucket);
                return 1;
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
     * @returns {object} returns a Redis client connection.
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
     * Redis error event handler.
     * @param {*} error
     * @returns {boolean} always returns `true`.
     * @private
     */
    [handleRedisError](error) {
        logger.error(error);
        if (error.syscall === 'connect' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            this.REDIS_AVAILABLE = false;
        }
        return true;
    }

    /**
     * Redis connection event handler.
     * @private
     */
    [handleRedisConnect]() {
        logger.info('Redis DB connected...');
        this.REDIS_AVAILABLE = true;
    }

    /**
     * Redis published pattern messages event handler.
     * @param {string} pattern
     * @param {string} channel
     * @param {string} message
     * @returns {boolean} always returns `true`.
     * @private
     */
    async [handleRedisPmessages](pattern, channel, message) {
        // Perform different actions based on the key event.
        switch (channel.match(/__keyevent@\d+__:(.+)/)[1]) {
            case 'expired':
                this.eventEmitter.emit('key.expired', message);
                break;
            default:
        }
        return true;
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
            case `${APP_NAME}_${APP_ENV}_bucket_del`:
                // logger.log(`Deleting bucket: ${message}`);
                // this.eventEmitter.emit('bucket.deleted', message);
                this.emit('bucket.deleted', message);
                // this[handleBucketDeleted](message);
                break;
            default:
                break;
        }
        return true;
    }

    /**
     * RedisManager key expiration event handler.
     * @param {string} key
     * @private
     */
    async [handleKeyExpired](key) {
        // logger.log(`Expired key: ${key}`);
        this[removeKey](key);
    }

    /**
     * RedisManager bucket deletion event handler.
     * @param {string} key the name of the bucket.
     * @private
     */
    async [handleBucketDeleted](key) {
        try {
            // logger.log(`Deleted bucket: ${key}`);
            // Queue up the key that needs to be removed
            const result = await this[sendCommandAsync]('EVALSHA', [this[bucketDeleteSha1], 1, key.split(`${this.BUCKET_PREFIX}-`).pop(), this.BUCKET_PREFIX]);
            return result;
        } catch (error) {
            logger.log(error);
            logger.log(`Unable to remove bucket: ${key}`);
            return 0;
        }
    }

    /**
     * Removes a key from the associated buckets and GLOBAL bucket.
     * @param {string} key
     * @param {number} 1 when the operation completes.
     * @private
     */
    async [removeKey](key) {
        try {
            // Queue up the key that needs to be removed
            this[removedKeys].push(key);
            setImmediate(this[purgeKeys].bind(this));
            return 1;
        } catch (error) {
            logger.log(`Unable to remove key: ${key}`);
            return 0;
        }
    }

    /**
     * Purge multiple keys from the cache.
     * @param {string} key
     * @param {number} 1 when the operation completes.
     * @private
     */
    async [purgeKeys]() {
        try {
            let allKeys = this[removedKeys]; // Split it up in 20 items chunks
            let rks; // removed keys
            let result;
            while (allKeys.length) {
                rks = _.take(allKeys, 20);
                // console.log(`# Keys being removed: ${rks.length}`);
                result = this[sendCommandAsync]('EVALSHA', [this[removeKeySha1], 2, this.BUCKET_PREFIX, this[removedKeys].length, ...rks]);
                allKeys = _.pull(allKeys, ...rks);
            }
            // const rks = this[removedKeys];
            this[removedKeys] = [];
            return result;
        } catch (error) {
            logger.log('Unable to remove keys.');
            return 0;
        }
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

module.exports = new RedisStorageManager();
