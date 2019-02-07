require('tz-config');

process.env.NODE_ENV = 'development';
process.env.APP_NAME = 'tz-cacher-dev';
process.env.REDIS_MANAGER_ON = 'true';
process.env.REDISCLOUD_URL = 'redis://localhost:6379';

const { promisify } = require('util');

const redis = require('redis');
const logger = require('tz-logger');

// Load assembler
const CacheAssembler = require('../../cache.assembler.js');

/* Constants and flags */
const APP_NAME = process.env.APP_NAME ? process.env.APP_NAME : 'tz-permissions';
/* The application envionment. */
const APP_ENV = process.env.NODE_ENV || 'dev';
const BUCKET_PREFIX = `BUCKET-${APP_NAME}`;
const MAX_RETRY_TIME = process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000;
const MAX_RETRY_ATTEMPTS = process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31;
const REDIS_RETRY_FREQ = process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000;
let REDIS_URL = process.env.REDISCLOUD_URL || process.env.REDIS_URL || 'redis://localhost:6379';

function sleep(ms) {
    console.log(`Waiting for ${ms} ms...`);
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

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
                this.REDIS_AVAILABLE = false;
                logger.error(`Maximum connection retry attempts (${MAX_RETRY_ATTEMPTS}) exhausted!`);
                return null;
            }
            // reconnect after
            return Math.min(options.attempt * REDIS_RETRY_FREQ, MAX_RETRY_TIME);
        }
    });
}

function getMemUsage(stats) {
    return stats.match(/used_memory_human:(.+)/)[1];
}

let cacheableObject = require('./stubs/testClass.stub.js');
let timer = require('./timer.js');

let cacheFactory;
let cachedObject;
let hashFactory;
let redisRWClient = createConnection();
let redisPSClient = createConnection();

/* Promisified node redis methods */
const existsAsync = promisify(redisRWClient.exists).bind(redisRWClient);
const sendCommandAsync = promisify(redisRWClient.send_command).bind(redisRWClient);
const scardAsync = promisify(redisRWClient.scard).bind(redisRWClient);
const ttlAsync = promisify(redisRWClient.ttl).bind(redisRWClient);
const smembersAsync = promisify(redisRWClient.smembers).bind(redisRWClient);
const srandmemberAsync = promisify(redisRWClient.srandmember).bind(redisRWClient);
const infoAsync = promisify(redisRWClient.info).bind(redisRWClient);
const dbsizeAsync = promisify(redisRWClient.dbsize).bind(redisRWClient);

/* Subscribe to key events */
let allBucketsDeleted = false;
redisPSClient.psubscribe('__keyevent@0__:del'); // Key deleted
redisPSClient.subscribe(`${APP_NAME}_${APP_ENV}_bucket_del`);
redisPSClient.on('message', async (channel, message) => {
    // Respond to messages that relate to bucket deletion channel
    switch (channel) {
        case `${APP_NAME}_${APP_ENV}_bucket_del`:
            allBucketsDeleted = true;
            break;
        default:
            break;
    }
    return true;
});

function getLoadStats(reqSize) {
    let start = new Date();
    return new Promise((resolve, reject) => {
        let interval = setInterval(async (reqSize) => {
            let dbsize = parseInt(await dbsizeAsync(), 10);
            if (dbsize === reqSize) {
                clearInterval(interval);
                resolve(new Date() - start);
            }
        }, 100, reqSize);
    });
}

function getReadStats(list, reqSize) {
    let start = new Date();
    return new Promise((resolve, reject) => {
        let interval = setInterval(async (reqSize) => {
            if (list.length === reqSize) {
                clearInterval(interval);
                resolve(new Date() - start);
            }
        }, 100, reqSize);
    });
}

function getPurgeStats() {
    let start = new Date();
    return new Promise((resolve, reject) => {
        let interval = setInterval(async () => {
            if (allBucketsDeleted) {
                clearInterval(interval);
                resolve(new Date() - start);
            }
        }, 100, 0);
    });
}

// Pre-set variables
// let objectsToLoad = [1000, 2000, 5000, 10000, 25000, 50000];
let numObjects = 500000;
let numBuckets = 5;
let timeToLoad = 6500; // ms
let timeToRead = 1000; // ms
let timeToPurge = 1000; // ms
// Data captured
let memUsed;
let results = [];
let stats = {
    numObjects,
    numBuckets,
    timeToLoad,
    timeToRead,
    timeToPurge,
    memUsed
};

(async () => {
    cacheFactory = CacheAssembler.getCacheFactory();
    hashFactory = CacheAssembler.getHashFactory();
    cachedObject = await cacheFactory.cachify(cacheableObject);
    // Adding 5 seconds delay
    await sleep(5000);
    if (redisRWClient.connected) {
        await sendCommandAsync('FLUSHALL');
        timer.start();
        console.log(`bucketMethod${numBuckets}: Loading ${numObjects} objects...`);
        timer.interval();
        for (let i = 0; i < numObjects; i += 1) {
            cachedObject[`bucketMethod${numBuckets}`](i);
        }
        // Wait for - Load Time
        timeToLoad = await getLoadStats(numObjects + numBuckets + 1);
        memUsed = getMemUsage(await infoAsync('memory'));
        console.log(`Data loaded. Time taken: ${timeToLoad} ms`);
        console.log(`Memory used: ${memUsed}`);
        timer.interval();
        console.log('-------------------------------------------------------------------------');
        console.log(`bucketMethod${numBuckets}: Fetching ${numObjects} objects...`);
        timer.interval();
        let fetchedData = [];
        for (let i = 0; i < numObjects; i += 1) {
            fetchedData.push(cachedObject[`bucketMethod${numBuckets}`](i));
        }
        // Wait for - Read Time
        timeToRead = await getReadStats(fetchedData, numObjects);
        console.log(`Data read. Time taken: ${timeToRead} ms`);
        console.log('-------------------------------------------------------------------------');
        console.log('Purging data...');
        cachedObject[`bucketMethodMutator${numBuckets}`]();
        // Wait for - Read Time
        timeToPurge = await getPurgeStats();
        console.log(`Data purged. Time taken: ${timeToPurge} ms`);
        stats = {
            numObjects,
            numBuckets,
            timeToLoad,
            timeToRead,
            timeToPurge,
            memUsed
        };
        // stats.memUsed = memUsed;
        results.push(stats);
        console.log(JSON.stringify(results));
    }
})();

