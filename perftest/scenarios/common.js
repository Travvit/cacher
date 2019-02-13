const { promisify } = require('util');
require('tz-config');

process.env.NODE_ENV = 'development';
process.env.APP_NAME = 'tz-cacher-dev';
process.env.REDIS_MANAGER_ON = 'true';
// process.env.REDISCLOUD_URL = 'redis://localhost:6379';

const redis = require('redis');
const logger = require('tz-logger');

let timer = require('../timer.js');
let cacheableObject = require('../fixtures/testClass.stub.js');
// Load assembler
const CacheAssembler = require('../../lib/cache.assembler.js');

/* Constants and flags */
const APP_NAME = process.env.APP_NAME ? process.env.APP_NAME : 'tz-permissions';
/* The application envionment. */
const APP_ENV = process.env.NODE_ENV || 'dev';
// const BUCKET_PREFIX = `BUCKET-${APP_NAME}`;
const MAX_RETRY_TIME = process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000;
const MAX_RETRY_ATTEMPTS = process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31;
const REDIS_RETRY_FREQ = process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000;
let REDIS_URL = process.env.REDISCLOUD_URL || process.env.REDIS_URL || 'redis://localhost:6379';


// Pre-set variables
let numObjects;
let numBuckets;
let timeToLoad; // ms
let timeToRead; // ms
let timeToPurge; // ms
let memUsed;
// Data captured
let stats = {
    numObjects,
    numBuckets,
    timeToLoad,
    timeToRead,
    timeToPurge,
    memUsed
};

function sleep(ms) {
    console.log(`Waiting for ${ms} ms...`);
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function getLoadStats(dbsizeAsync, reqSize) {
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

let allBucketsDeleted = false;

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

function getMemUsage(stats) {
    return stats.match(/used_memory_human:(.+)/)[1];
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

let redisRWClient = createConnection();
let redisPSClient = createConnection();

/* Promisified node redis methods */
const sendCommandAsync = promisify(redisRWClient.send_command).bind(redisRWClient);
const infoAsync = promisify(redisRWClient.info).bind(redisRWClient);
const dbsizeAsync = promisify(redisRWClient.dbsize).bind(redisRWClient);

redisPSClient.subscribe(`${APP_NAME}_${APP_ENV}_bucket_del`);
redisPSClient.on('message', async (channel, message) => {
    // Respond to messages that relate to bucket deletion channel
    switch (channel) {
        case `${APP_NAME}_${APP_ENV}_bucket_del`:
            if (message.endsWith('-GLOBAL')) {
                allBucketsDeleted = true;
            }
            break;
        default:
            break;
    }
    return true;
});

let cacheFactory;
let cachedObject;

async function initTests() {
    cacheFactory = CacheAssembler.getCacheFactory();
    cachedObject = await cacheFactory.cachify(cacheableObject);
    // Adding 5 seconds delay
    return sleep(2000);
}

// initTests();

// (async () => {
//     return await initTests();
// })();

module.exports = {
    timer,
    redisRWClient,
    sendCommandAsync,
    logger,
    sleep,
    cachedObject,
    cacheFactory,
    CacheAssembler,
    cacheableObject,
    timeToLoad,
    getLoadStats,
    dbsizeAsync,
    memUsed,
    getMemUsage,
    infoAsync,
    timeToRead,
    getReadStats,
    timeToPurge,
    getPurgeStats,
    stats
};
