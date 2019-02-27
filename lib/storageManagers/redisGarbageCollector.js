// require('tz-config');
const timer = require('../../perftest/timer.js');
timer.start();
const logger = require('tz-logger');
const GarbageCollector = require('./garbageCollector.js');
const redis = require('redis');
const { promisify } = require('util');
const _ = require('lodash');

// process.env.REDIS_MANAGER_ON = 'true';
process.env.NODE_ENV = 'development';
process.env.APP_NAME = 'tz-cacher-dev';
process.env.REDISCLOUD_URL = 'redis://localhost:6379';

/* Constants and flags */
const APP_NAME = process.env.APP_NAME ? process.env.APP_NAME : 'tz-permissions';
const APP_ENV = process.env.NODE_ENV || 'development';

let REDIS_MANAGER_ON = true;
let REDIS_AVAILABLE = true;

const MAX_RETRY_TIME = process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000;
const MAX_RETRY_ATTEMPTS = process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31;
const REDIS_RETRY_FREQ = process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000;
let REDIS_URL = process.env.REDISCLOUD_URL || process.env.REDIS_URL || 'redis://localhost:6379';
/* GC Master lease renew duration in milliseconds. */
const GCM_LEASE_DURATION = 5 * 1000;

/* HELPER METHODS */
function createConnection() {
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
                REDIS_AVAILABLE = false;
                logger.error(`Maximum connection retry attempts (${MAX_RETRY_ATTEMPTS}) exhausted!`);
                return null;
            }
            // reconnect after
            return Math.min(options.attempt * REDIS_RETRY_FREQ, MAX_RETRY_TIME);
        }
    });
}

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

let redisRWClient = createConnection();

redisRWClient.on('connect', () => {
    this.REDIS_AVAILABLE = true;
});

/* Private method names */
const getLock = Symbol('getLock');
const releaseLock = Symbol('releaseLock');
const checkRedisAvailable = Symbol('checkRedisAvailable');
const getBuckets = Symbol('getBuckets');
const cleanBucket = Symbol('cleanBucket');
const getOrRenewLeaseLock = Symbol('getOrRenewLeaseLock');
const executeGC = Symbol('executeGC');
const generateGCSessionKey = Symbol('generateGCSessionKey');

// Redis commands
const sendCommandAsync = promisify(redisRWClient.send_command).bind(redisRWClient);
const keysAsync = promisify(redisRWClient.keys).bind(redisRWClient);
const scardAsync = promisify(redisRWClient.scard).bind(redisRWClient);

/**
 * This module should be run as a forked process by a RedisStorageManager.
 */
class RedisGarbageCollector extends GarbageCollector {
    /**
     * Runs the garbage collection process.
     */
    async run() {
        try {
            logger.log('Running GC...');
            let leaseRenewTimer;
            // Get GC master lease and renew lease if possible
            this.key = await this[generateGCSessionKey]();
            let res = await this[getOrRenewLeaseLock]('gc_lock', this.key, GCM_LEASE_DURATION);
            if (res) {
                logger.log('I am the master!!!');
                // Start lease auto renew.
                leaseRenewTimer = setInterval(this[getOrRenewLeaseLock].bind(this), GCM_LEASE_DURATION - 100, 'gc_lock', this.key, GCM_LEASE_DURATION);
                // Now run the GC tasks.
                await this[executeGC]();
                // Clear the lease renew timer
                clearInterval(leaseRenewTimer);
            } else {
                logger.log('I am just a follower...');
                // return;
            }
            await sleep(GCM_LEASE_DURATION);
            timer.interval();
        } catch (error) {
            logger.log(error.message);
        }
    }

    /**
     * Starts the garbage collection process.
     */
    async start() {
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
     * Generates the GC session key.
     */
    async [generateGCSessionKey]() {
        logger.log(`Generated session key: ${APP_NAME}`);
        return APP_NAME;
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
        if (REDIS_MANAGER_ON && REDIS_AVAILABLE) {
            return true;
        }
        return false;
    }
}

// Run the garbage collector.
const gc = new RedisGarbageCollector();

gc.start();

/**
 * Perform cleanup here because the process is about to terminate.
 */
process.on('SIGTERM', gc.shutdown);
