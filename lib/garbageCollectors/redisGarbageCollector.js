/* eslint-disable max-len */
const timer = require('../utils/timer.js');

timer.start();

const logger = require('tz-logger');
const GarbageCollector = require('./garbageCollector.js');
const redis = require('redis');
const { promisify } = require('util');
const si = require('systeminformation');

// The minimum GC interval time (ms).
const GC_INTERVAL_MIN = 30000;

/* Private method names */
const releaseLock = Symbol('releaseLock');
const checkRedisAvailable = Symbol('checkRedisAvailable');
const getBuckets = Symbol('getBuckets');
const cleanBucket = Symbol('cleanBucket');
const getOrRenewLeaseLock = Symbol('getOrRenewLeaseLock');
const executeGC = Symbol('executeGC');
const generateGCSessionKey = Symbol('generateGCSessionKey');
const createConnection = Symbol('createConnection');
const handleRedisConnect = Symbol('handleRedisConnect');
const handleRedisError = Symbol('handleRedisError');
const send = Symbol('send');
const checkCPULoad = Symbol('checkCPULoad');
const run = Symbol('run');

const redisRWClient = Symbol('redisRWClient');

// Redis async commands
const sendCommandAsync = Symbol('sendCommandAsync');
const keysAsync = Symbol('keysAsync');
const scardAsync = Symbol('scardAsync');

/**
 * This module should be run as a forked process by a RedisStorageManager.
 */
class RedisGarbageCollector extends GarbageCollector {
    /**
     * Middleware to load the test options from the commandline arguments or the configuration file.
     * @param {*} argv the parsed arguments passed to the process.
     */
    async loadOptions(argv) {
        // logger.log('Loading GC options...');
        this.NODE_ENV = argv.NODE_ENV;
        this.APP_NAME = argv.APP_NAME;
        this.MAX_RETRY_TIME = argv.MAX_RETRY_TIME;
        this.MAX_RETRY_ATTEMPTS = argv.MAX_RETRY_ATTEMPTS;
        this.REDIS_RETRY_FREQ = argv.REDIS_RETRY_FREQ;
        this.REDIS_URL = argv.REDIS_URL;
        this.GCM_LEASE_DURATION = argv.GCM_LEASE_DURATION;
        this.REDIS_MANAGER_ON = argv.REDIS_MANAGER_ON;
        this.CPU_LOAD_CUTOFF = argv.CPU_LOAD_CUTOFF;
        this.REG_BUCKET_MEMBER_BULK_GC_SIZE = argv.REG_BUCKET_MEMBER_BULK_GC_SIZE;
        this.GLOBAL_BUCKET_MEMBER_BULK_GC_SIZE = argv.GLOBAL_BUCKET_MEMBER_BULK_GC_SIZE;
    }

    /**
     * Middleware to initialize the process.
     */
    async init() {
        try {
            // logger.log('Initializing GC process...');
            this.REDIS_AVAILABLE = false;
            this[redisRWClient] = await this[createConnection]();

            // Promisify Redis commands
            this[sendCommandAsync] = promisify(this[redisRWClient].send_command).bind(this[redisRWClient]);
            this[keysAsync] = promisify(this[redisRWClient].keys).bind(this[redisRWClient]);
            this[scardAsync] = promisify(this[redisRWClient].scard).bind(this[redisRWClient]);

            /* Event handlers */
            // Redis Events
            this[redisRWClient].on('connect', this[handleRedisConnect].bind(this));
            this[redisRWClient].on('error', this[handleRedisError].bind(this));
        } catch (error) {
            logger.error(error.message);
        }
    }

    /**
     * Starts the garbage collection process.
     */
    async start() {
        this[send]('GC process started.');
        logger.log(`
Starting Garbage Collection process:
================================================
    Time: ${new Date()}
    Environment: ${this.NODE_ENV}
    Application: ${this.APP_NAME}
    GC Lease Duration: ${this.GCM_LEASE_DURATION}
    Acceptable CPU Usage: ${this.CPU_LOAD_CUTOFF}%
================================================
        `);
        // Schedule GC
        this.gcTimer = setImmediate(this[run].bind(this), this.gcTimer);
    }

    /**
     * Shuts down the garbage collection process.
     */
    async shutdown() {
        logger.log('GC timed out, or killed!');
        // Release lock
        logger.log(await this[releaseLock]('gc_lock', this.key));
        timer.intervalMS();
        this[send]('GC process terminated.');
        process.exit();
    }

    /* Private methods */

    /**
     * Runs the garbage collection process.
     * @param {*} gcTimer the reference to the timer.
     * @private
     */
    async [run](gcTimer) {
        try {
            // logger.log('Running GC...');
            this[send]('Running GC.');
            clearImmediate(gcTimer);
            let leaseRenewTimer;
            // Get GC master lease and renew lease if possible
            this.key = await this[generateGCSessionKey]();
            let res = await this[getOrRenewLeaseLock]('gc_lock', this.key, this.GCM_LEASE_DURATION);
            if (res && await this[checkCPULoad]()) {
                // logger.log(chalk.green('GC master status acquisition success.'));
                // Start lease auto renew, one second before lease expiration.
                leaseRenewTimer = setInterval(this[getOrRenewLeaseLock].bind(this), this.GCM_LEASE_DURATION - 1000, 'gc_lock', this.key, this.GCM_LEASE_DURATION);
                // Now run the GC tasks.
                await this[executeGC]();
                // Clear the lease renew timer
                clearInterval(leaseRenewTimer);
            } else {
                // logger.log(chalk.red('GC master status acquisition failed.'));
            }
            await timer.sleep(this.GCM_LEASE_DURATION);
            timer.intervalMS();
        } catch (error) {
            logger.error('Error running GC.');
        }
        // Reschedule GC
        this.gcTimer = setImmediate(this[run].bind(this), this.gcTimer);
    }

    /**
     * Ensures that the current CPU load percentage is below the cutoff threshold.
     * @private
     */
    async [checkCPULoad]() {
        try {
            const currentLoad = await si.currentLoad();
            if (currentLoad.currentload < this.CPU_LOAD_CUTOFF) {
                return true;
            }
        } catch (error) {
            logger.error(error.message);
        }
        return false;
    }

    /**
     * The method used to send IPC messages to parent process.
     * @param {string} message the message being sent to parent process.
     * @private
     */
    [send](message) {
        try {
            if (process.send) {
                process.send(message);
            }
        } catch (error) {
            logger.error(error.message);
        }
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
    async [createConnection]() {
        return redis.createClient({
            url: this.REDIS_URL,
            retry_strategy(options) {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    // End reconnecting on a specific error and flush all commands
                    // logger.error('The server refused the connection!');
                }
                if (options.total_retry_time > this.MAX_RETRY_TIME) {
                    // End reconnecting after a specific timeout and flush all commands
                    logger.error(`Connection lost with Redis for more than ${this.MAX_RETRY_TIME / 1000} seconds. Retry time exhausted!`);
                    return null;
                }
                if (options.attempt > this.MAX_RETRY_ATTEMPTS) {
                    // End reconnecting with built in error
                    this.REDIS_AVAILABLE = false;
                    logger.error(`Maximum connection retry attempts (${this.MAX_RETRY_ATTEMPTS}) exhausted!`);
                    return null;
                }
                // reconnect after
                return Math.min(options.attempt * this.REDIS_RETRY_FREQ, this.MAX_RETRY_TIME);
            }
        });
    }

    /**
     * Redis connection event handler.
     * @private
     */
    [handleRedisConnect]() {
        // logger.info('Redis DB connected...');
        this.REDIS_AVAILABLE = true;
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
     * Generates the GC session key.
     * @private
     */
    async [generateGCSessionKey]() {
        return this.APP_NAME;
    }

    /**
     * This method executes the garbage collection operations.
     * @private
     */
    async [executeGC]() {
        try {
            // logger.log('Execute GC...');
            // GC start
            this[send]('GC started.');
            // Get a list of buckets within an environment.
            const buckets = await this[getBuckets](this.NODE_ENV);
            if (buckets.length) {
                // Save the buckets along with their size
                const bucketSizePromises = [];
                buckets.forEach(async (bucket) => {
                    // Calculate size.
                    bucketSizePromises.push(this[scardAsync](bucket));
                });
                // Wait for the sizes
                const bucketSizes = await Promise.all(bucketSizePromises);
                // Add the bucket items to bukets list
                const bucketsList = [];
                buckets.forEach(async (bucket, index) => {
                    bucketsList.push({
                        bucket,
                        size: bucketSizes[index]
                    });
                });
                // Sort based on bucket size
                bucketsList.sort((first, second) => first.size - second.size);
                // Clean the buckets.
                timer.intervalMS();
                const cleanBucketPromises = [];
                bucketsList.forEach((bucketItem) => {
                    cleanBucketPromises.push(this[cleanBucket](bucketItem.bucket));
                });
                await Promise.all(cleanBucketPromises);
                logger.log(`Clean buckets. Elapsed time: ${timer.intervalMS()}`);
            }
            this[send]('GC completed.');
        } catch (error) {
            logger.error(error.message);
        }
    }

    /**
     * Returns a list of buckets within the specified environment.
     * @param {string} env name of environment.
     * @private
     */
    async [getBuckets](env) {
        return this[keysAsync](`BUCKET.${env}.*`);
    }

    /**
     * Cleans a specified bucket by invokign a Redis script.
     * @param {string} bucket the name of the bucket being cleared.
     * @private
     */
    async [cleanBucket](bucket) {
        // logger.log(`Cleaning bucket: ${bucket}`);
        if (this[checkRedisAvailable]()) {
            try {
                const cleanBucketCmd = `
                redis.replicate_commands();
                print('\\n\\n-- cleanBucketCmd --------------------');
                local bucket = ARGV[1];
                -- print('Bucket: ' .. bucket);
                local bucketMembers;
                local deletedMembers = {};
                local result;

                -- Timing variables --
                ----------------------
                local startTime;
                local startSec;
                local startMs;
                local totalStartMs;
                local endTime;
                local endSec;
                local endMs;
                local totalEndMs;

                -- Helper Functions --
                ----------------------
                local ends_with = function(str, ending)
                    return ending == "" or str:sub(-#ending) == ending
                end

                local startTimerFn = function()
                    startTime = redis.call('TIME');
                    startSec = startTime[1] % 1000;
                    startMs = startTime[2];
                    totalStartMs = startMs + (startSec * 1000 * 1000);
                end;

                local endTimerFn = function()
                    endTime = redis.call('TIME');
                    endSec = endTime[1] % 1000;
                    endMs = endTime[2];
                    totalEndMs = endMs + (endSec * 1000 * 1000);
                    print(string.format("elapsed time: %.3fs", (totalEndMs - totalStartMs) / 1000000));
                end;

                --- Checks GLOBAL bucket for expired keys, and removes them if they are.
                -- @param myBucket the name of the GLOBAL bucket
                local deletableMember;
                local globalKey;
                local cleanGlobalBucketFn = function(myBucket)
                    --startTimerFn();
                    print('-- cleanGlobalBucketFn -------------------------');
                    bucketMembers = redis.call('SMEMBERS', myBucket);
                    -- print('No of items in GLOBAL bucket: ' .. table.getn(bucketMembers));
                    -- Queue up expired bucket members for deletion
                    for key, val in pairs(bucketMembers) do
                        -- io.write('.');
                        deletableMember = val;
                        globalKey = cjson.decode(deletableMember)['key'];
                        -- Check to see if the bucket member exists
                        if redis.call('EXISTS', globalKey) == 0 then
                            table.insert(deletedMembers, deletableMember);
                        end;
                        if table.getn(deletedMembers) >= ${this.GLOBAL_BUCKET_MEMBER_BULK_GC_SIZE} then
                            -- Remove the bucket members
                            -- print('Deleting GLOBAL keys in bulk.')
                            redis.call('SREM', myBucket, unpack(deletedMembers));
                            deletedMembers = {};
                        end;
                    end;
                    print('Queue complete.');

                    -- Delete the remaining keys
                    if table.getn(deletedMembers) > 0 then
                        -- print('Deleting GLOBAL keys.')
                        redis.call('SREM', myBucket, unpack(deletedMembers));
                    end;
                    -- Now delete the bucket if empty
                    -- print('* Checking GLOBAL bucket size -->');
                    if redis.call('SCARD', myBucket) == 0 then
                        result = redis.call('DEL', myBucket);
                        -- print('* Publishing GLOBAL bucket delete -->');
                        redis.call('PUBLISH', "${this.NODE_ENV}:bucket_del", myBucket);
                    end;
                    --endTimerFn();
                end;

                --- Checks a regular bucket for expired keys, and removes them if they are.
                -- @param myBucket the name of the bucket
                local cleanBucketFn = function(myBucket)
                    --startTimerFn();
                    print('-- cleanBucketFn -------------------------')
                    bucketMembers = redis.call('SMEMBERS', myBucket);
                    -- print('No of items in regular bucket: ' .. table.getn(bucketMembers));
                    for i = 1, table.getn(bucketMembers), 1 do
                        -- Check to see if the bucket member exists
                        if redis.call('EXISTS', bucketMembers[i]) == 0 then
                            table.insert(deletedMembers, bucketMembers[i]);
                        end;
                        if table.getn(deletedMembers) >= ${this.REG_BUCKET_MEMBER_BULK_GC_SIZE} then
                            -- Remove the bucket members
                            redis.call('SREM', myBucket, unpack(deletedMembers));
                            deletedMembers = {};
                        end;
                    end;
                    print('Queue complete.');
                    -- Delete the remaining keys
                    if table.getn(deletedMembers) > 0 then
                        redis.call('SREM', myBucket, unpack(deletedMembers));
                    end;
                    -- Now delete the bucket if empty
                    if redis.call('SCARD', myBucket) == 0 then
                        result = redis.call('DEL', myBucket);
                    end;
                    --endTimerFn();
                end;

                startTimerFn();
                if ends_with(bucket, 'GLOBAL') then
                    cleanGlobalBucketFn(bucket);
                else
                    cleanBucketFn(bucket);
                end;
                endTimerFn();
                return 1;
                `;
                const result = this[sendCommandAsync]('EVAL', [cleanBucketCmd, 0, bucket]);
                return result;
            } catch (error) {
                logger.log(error.message);
                return null;
            }
        }
        return null;
    }

    /**
     * This method is used to atomically check and set a GC lease lock within Redis.
     * @param {string} resource the name of the resource being lease.
     * @param {*} value the value that is used to identify the lock owner.
     * @param {*} duration the duration in milliseconds for which the lease is valid.
     * @private
     */
    async [getOrRenewLeaseLock](resource, value, duration) {
        if (this[checkRedisAvailable]()) {
            try {
                timer.intervalMS();
                const getOrRenewLeaseLockCmd = `
                redis.replicate_commands();
                print('-- getOrRenewLeaseLockCmd --------------------');
                local NODE_ENV = ARGV[1];
                local resource = ARGV[2];
                local value = ARGV[3];
                local duration = ARGV[4];

                -- Helper functions --
                --- Returns true if the current app is the owner of the resource
                -- @param key The key for the resource being leased.
                -- @param value The value stored in the resource key to identify owner.
                local isOwner = function (key, value)
                    print('-- isOwner --------------------');
                    if redis.call('get', key) == value then
                        -- Resource owner match
                        return true;
                    else
                        -- Not resource owner
                        return false;
                    end;
                end;

                --- Renews the lease by resetting the TTL
                -- @param key The key for the resource being leased.
                -- @param duration The TTL duration in ms for which the lease is active.
                local renewLease = function (key, duration)
                    print('-- renewLease --------------------');
                    redis.call('PEXPIRE', key, duration);
                end;

                --- Atomically set the lease key
                -- @param key The key for the resource being leased.
                -- @param value The value stored in the resource key to identify owner.
                -- @param duration The TTL duration in ms for which the lease is active.
                local setLeaseKey = function (key, value, duration)
                    print('-- setLeaseKey --------------------');
                    if redis.call('SET', key, value, 'NX', 'PX', duration) then
                        return true;
                    else
                        return false;
                    end;
                end;

                -- Get GC lease
                local leaseKey = 'LOCK.' .. NODE_ENV .. '.' .. resource;
                if redis.call('EXISTS', leaseKey) == 1 then
                    if isOwner(leaseKey, value) then
                        renewLease(leaseKey, duration);
                        return 1;
                    else
                        return 0;
                    end;
                else
                    if setLeaseKey(leaseKey, value, duration) then
                        return 1;
                    else
                        return 0;
                    end;
                end;
                `;
                const result = await this[sendCommandAsync]('EVAL', [getOrRenewLeaseLockCmd, 0, this.NODE_ENV, resource, value, duration]);
                this.leaseReqTime = timer.intervalMS(); // * Used for tracking
                return result;
            } catch (error) {
                logger.log(error.message);
                return null;
            }
        }
        return null;
    }

    /**
     * The method used to atomically check and remove the GC lock within Redis.
     * @param {*} resource the name of the resource being locked.
     * @param {*} value the pseudorandom value used to create the lock.
     * @private
     */
    async [releaseLock](resource, value) {
        if (this[checkRedisAvailable]()) {
            try {
                const releaseLockCmd = `
                redis.replicate_commands();
                print('-- releaseLockCmd --------------------');
                local NODE_ENV = ARGV[1];
                local resource = ARGV[2];
                local value = ARGV[3];
                
                -- Helper functions --
                --- Returns true if the current app is the owner of the resource
                -- @param key The key for the resource being leased.
                -- @param value The value stored in the resource key to identify owner.
                local isOwner = function (key, value)
                    print('-- isOwner --------------------');
                    if redis.call('get', key) == value then
                        -- Resource owner match
                        return true;
                    else
                        -- Not resource owner
                        return false;
                    end;
                end;

                -- Release GC lease
                local leaseKey = 'LOCK.' .. NODE_ENV .. '.' .. resource;
                if redis.call('EXISTS', leaseKey) == 1 then
                    if isOwner(leaseKey, value) then
                        redis.call('DEL', leaseKey)
                        return 1;
                    else
                        return 0;
                    end;
                else
                    return 0;
                end;
                `;
                const result = await this[sendCommandAsync]('EVAL', [releaseLockCmd, 0, this.NODE_ENV, resource, value]);
                return result;
            } catch (error) {
                logger.log(error.message);
                return null;
            }
        }
        return null;
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
}

// Instantiate a GC
const gc = new RedisGarbageCollector();

const argv = require('yargs/yargs')(process.argv.slice(2))
    .options({
        NODE_ENV: {
            describe: 'The application envionment.',
            default: process.env.NODE_ENV || 'development',
            type: 'string'
        },
        APP_NAME: {
            describe: 'The application name',
            default: process.env.APP_NAME || 'tz-cacher',
            type: 'string'
        },
        MAX_RETRY_TIME: {
            describe: 'The maximum retry time in milliseconds after which retry attempts will fail.',
            default: process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000,
            type: 'number'
        },
        MAX_RETRY_ATTEMPTS: {
            describe: 'The maximum retry times after which retry attempts will fail.',
            default: process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31,
            type: 'number'
        },
        REDIS_RETRY_FREQ: {
            describe: 'The frequency in milliseconds with which connection retry is attempted.',
            default: process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000,
            type: 'number'
        },
        REDIS_URL: {
            describe: 'The URL to the Redis server.',
            default: process.env.REDISCLOUD_URL || process.env.REDIS_URL || 'redis://localhost:6379',
            type: 'string'
        },
        REDIS_MANAGER_ON: {
            describe: 'The flag that allows Redis caching to be turned off.',
            default: process.env.REDIS_MANAGER_ON === 'true' || true,
            type: 'boolean'
        },
        GCM_LEASE_DURATION: {
            describe: 'GC Master lease renew duration in milliseconds.',
            default: (process.env.REDIS_GC_INTERVAL && (parseInt(process.env.REDIS_GC_INTERVAL, 10) > GC_INTERVAL_MIN)) ? parseInt(process.env.REDIS_GC_INTERVAL, 10) : GC_INTERVAL_MIN,
            type: 'number'
        },
        CPU_LOAD_CUTOFF: {
            describe: 'The percentage of CPU usage the is permissible for GC.',
            default: process.env.CPU_LOAD_CUTOFF ? parseInt(process.env.CPU_LOAD_CUTOFF, 10) : 50,
            type: 'number'
        },
        REG_BUCKET_MEMBER_BULK_GC_SIZE: {
            describe: 'Number of members deleted in bulk from a regular bucket during GC.',
            default: process.env.REG_BUCKET_MEMBER_BULK_GC_SIZE ? parseInt(process.env.REG_BUCKET_MEMBER_BULK_GC_SIZE, 10) : 2000,
            type: 'number'
        },
        GLOBAL_BUCKET_MEMBER_BULK_GC_SIZE: {
            describe: 'Number of members deleted in bulk from the Global bucket during GC.',
            default: process.env.GLOBAL_BUCKET_MEMBER_BULK_GC_SIZE ? parseInt(process.env.GLOBAL_BUCKET_MEMBER_BULK_GC_SIZE, 10) : 1000,
            type: 'number'
        }
    })
    .help()
    .alias('v', 'version')
    .alias('h', 'help')
    .wrap(120)
    .command(['*'], 'the default command', () => {}, gc.start.bind(gc))
    .middleware([
        gc.loadOptions.bind(gc),
        gc.init.bind(gc)
    ])
    .argv;

/**
 * Perform cleanup here because the process is about to terminate.
 */
process.on('SIGTERM', gc.shutdown.bind(gc));
process.on('SIGINT', gc.shutdown.bind(gc));
process.on('unhandledRejection', (reason, promise) => {
    logger.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    logger.log(error.message);
});

