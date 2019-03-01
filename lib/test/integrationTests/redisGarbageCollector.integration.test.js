/* eslint-disable max-len */
const chai = require('chai').use(require('chai-as-promised'));

const { assert, expect } = chai;
const logger = require('tz-logger');

const gcProcess = require('child_process').fork(`${__dirname}/../../garbageCollectors/redisGarbageCollector.js`);

// const RedisGarbageCollector = require('../../garbageCollectors/redisGarbageCollector.js');
const redis = require('redis');
const timer = require('../../utils/timer.js');

// Load test subject
// const garbageCollector = new RedisGarbageCollector();

// Necessary constants
process.env.REDIS_MANAGER_ON = 'true';
process.env.NODE_ENV = 'development';
process.env.APP_NAME = 'tz-cacher-dev';
process.env.REDISCLOUD_URL = 'redis://localhost:6379';
const APP_NAME = process.env.APP_NAME ? process.env.APP_NAME : 'tz-permissions';
const APP_ENV = process.env.NODE_ENV || 'development';
const MAX_RETRY_TIME = process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000;
const MAX_RETRY_ATTEMPTS = process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31;
const REDIS_RETRY_FREQ = process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000;
let REDIS_URL = process.env.REDISCLOUD_URL || process.env.REDIS_URL || 'redis://localhost:6379';

// Helper methods
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

describe('RedisGarbageCollector', () => {
    let redisRWClient = createConnection();

    before(async () => {});
});
