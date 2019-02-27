// require('tz-config');
const timer = require('../../perftest/timer.js');
timer.start();
const logger = require('tz-logger');
const GarbageCollector = require('./garbageCollector.js');
const redis = require('redis');
const { promisify } = require('util');
const _ = require('lodash');

const GC_INTERVAL_MIN = 15000;

/* HELPER METHODS */
function sleep(ms) {
    // console.log(`Waiting for ${ms} ms...`);
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function getRandom() {
    const min = 0;
    const max = 1000000000;
    let random = Math.floor(Math.random() * (+max - +min)) + +min;
    return random;
}

/* Private method names */
const getLock = Symbol('getLock');
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
     */
    async loadOptions(argv) {
        logger.log('Loading GC options...');
        // logger.log(this);
        this.NODE_ENV = argv.NODE_ENV;
        this.APP_NAME = argv.APP_NAME;
        this.MAX_RETRY_TIME = argv.MAX_RETRY_TIME;
        this.MAX_RETRY_ATTEMPTS = argv.MAX_RETRY_ATTEMPTS;
        this.REDIS_RETRY_FREQ = argv.REDIS_RETRY_FREQ;
        this.REDIS_URL = argv.REDIS_URL;
        this.GCM_LEASE_DURATION = argv.GCM_LEASE_DURATION;
        this.REDIS_MANAGER_ON = argv.REDIS_MANAGER_ON;
    }

    /**
     * Middleware to initialize the process.
     * @param {*} argv
     */
    async init(argv) {
        try {
            logger.log('Initializing GC process...');
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
     * Runs the garbage collection process.
     */
    async run() {
        try {
            logger.log('Running GC...');
            let leaseRenewTimer;
            // Get GC master lease and renew lease if possible
            this.key = await this[generateGCSessionKey]();
            let res = await this[getOrRenewLeaseLock]('gc_lock', this.key, this.GCM_LEASE_DURATION);
            if (res) {
                logger.log('I am the master!!!');
                // Start lease auto renew.
                leaseRenewTimer = setInterval(this[getOrRenewLeaseLock].bind(this), this.GCM_LEASE_DURATION - 100, 'gc_lock', this.key, this.GCM_LEASE_DURATION);
                // Now run the GC tasks.
                await this[executeGC]();
                // Clear the lease renew timer
                clearInterval(leaseRenewTimer);
            } else {
                logger.log('I am just a follower...');
                // return;
            }
            await sleep(this.GCM_LEASE_DURATION);
            timer.interval();
        } catch (error) {
            logger.log(error.message);
        }
    }

    /**
     * Starts the garbage collection process.
     */
    async start() {
        logger.log(`
Starting Garbage Collection process:
================================================
Environment: ${this.NODE_ENV}
Application: ${this.APP_NAME}
        `);
        // Run the GC forever.
        while (true) {
            await this.run();
        }
    }

    /**
     * Shuts down the garbage collection process.
     */
    async shutdown() {
        logger.log('GC timed out, or killed!');
        // Release lock
        logger.log(await this[releaseLock]('gc_lock', this.key));
        timer.interval();
    }

    /* Private methods */

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
                    logger.error('The server refused the connection!');
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
        logger.info('Redis DB connected...');
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
     */
    async [generateGCSessionKey]() {
        logger.log(`Generated session key: ${this.APP_NAME}`);
        return this.APP_NAME;
    }

    /**
     * This method executes the garbage collection operations.
     */
    async [executeGC]() {
        logger.log('Execute GC...');
        // GC start
        const buckets = await this[getBuckets](APP_ENV);
        // logger.log(JSON.stringify(buckets));
        logger.log(`No of buckets: ${buckets.length}`);
        if (buckets.length) {
            // Save the buckets along with their size
            const bucketList = [];
            _.forEach(buckets, async (bucket) => {
                // logger.log(`Size: ${await scardAsync(bucket)}`);
                bucketList.push({ bucket, size: await scardAsync(bucket) });
            });
            // Sort based on bucket size
            bucketList.sort((first, second) => first.size - second.size);
            // Clean the buckets.
            const cleanBucketPromises = [];
            _.forEach(bucketList, (bucketItem) => {
                cleanBucketPromises.push(this[cleanBucket](bucketItem.bucket));
            });
            await Promise.all(cleanBucketPromises);
        }
        await sleep(10 * 1000);
        // GC complete
        logger.log('GC Complete!');
    }

    /**
     * Returns a list of buckets within the specified environment.
     * @param {string} env name of environment.
     */
    async [getBuckets](env) {
        return keysAsync(`BUCKET.${env}.*`);
    }

    /**
     * Cleans a specified bucket by invokign a Redis script.
     * @param {string} bucket the name of the bucket being cleared.
     */
    async [cleanBucket](bucket) {
        logger.log(`Cleaning bucket: ${bucket}`);
        if (this[checkRedisAvailable]()) {
            try {
                const cleanBucketCmd = `
                local bucket = ARGV[1];
                return "Buckets cleaned: " .. bucket;
                `;
                const result = await sendCommandAsync('EVAL', [cleanBucketCmd, 0, bucket]);
                await sleep(1000); // * Simulate bucket purge
                logger.log(result);
                return result;
            } catch (error) {
                logger.log(error.message);
                return null;
            }
        }
        return null;
    }

    /**
     * The method used to atomically check and set the GC lock within Redis.
     * @param {string} resource the name of the resource being locked.
     * @param {string} value the pseudorandom value used to create the lock.
     * @param {number} timeout the time in milliseconds after which the lock will be automatically released.
     */
    async [getLock](resource, value, timeout) {
        logger.log('Getting lock...');
        if (this[checkRedisAvailable]()) {
            try {
                const getLockCmd = `
                print('-- getLockCmd --------------------');
                local APP_ENV = ARGV[1];
                local resource = ARGV[2];
                local value = ARGV[3];
                local timeout = ARGV[4];
                local res;
                res = redis.call('SET', 'LOCK.' .. APP_ENV .. '.' .. resource, value, 'NX', 'PX', timeout);
                return res;`;
                const result = await sendCommandAsync('EVAL', [getLockCmd, 0, APP_ENV, resource, value, timeout]);
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
     */
    async [getOrRenewLeaseLock](resource, value, duration) {
        logger.log('Getting or renewing lease...');
        if (this[checkRedisAvailable]()) {
            try {
                timer.interval();
                const getOrRenewLeaseLockCmd = `
                print('-- getOrRenewLeaseLockCmd --------------------');
                local APP_ENV = ARGV[1];
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
                local leaseKey = 'LOCK.' .. APP_ENV .. '.' .. resource;
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
                const result = await sendCommandAsync('EVAL', [getOrRenewLeaseLockCmd, 0, APP_ENV, resource, value, duration]);
                this.leaseReqTime = timer.interval(); // * Used for tracking
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
     */
    async [releaseLock](resource, value) {
        logger.log('Releasing lock...');
        if (this[checkRedisAvailable]()) {
            try {
                const releaseLockCmd = `
                print('-- releaseLockCmd --------------------');
                local APP_ENV = ARGV[1];
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
                local leaseKey = 'LOCK.' .. APP_ENV .. '.' .. resource;
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
                const result = await sendCommandAsync('EVAL', [releaseLockCmd, 0, APP_ENV, resource, value]);
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
            default: process.env.APP_NAME || 'tz-permissions',
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
            default: process.env.REDIS_MANAGER_ON === 'true' || false,
            type: 'boolean'
        },
        GCM_LEASE_DURATION: {
            describe: 'GC Master lease renew duration in milliseconds.',
            default: (process.env.REDIS_GC_INTERVAL && (parseInt(process.env.REDIS_GC_INTERVAL, 10) > GC_INTERVAL_MIN)) ? parseInt(process.env.REDIS_GC_INTERVAL, 10) : GC_INTERVAL_MIN,
            type: 'boolean'
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

// Run the garbage collector.
// gc.start();

/**
 * Perform cleanup here because the process is about to terminate.
 */
process.on('SIGTERM', gc.shutdown);
