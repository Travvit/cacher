/* eslint-disable global-require */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
// Load environment variables
require('tz-config');

process.env.NODE_ENV = 'development';
process.env.APP_NAME = 'tz-cacher-dev';
process.env.REDIS_MANAGER_ON = 'true';

const chai = require('chai').use(require('chai-as-promised'));
const { promisify } = require('util');

const { assert, expect } = chai;
const redis = require('redis');
const logger = require('tz-logger');

// Load assembler
const CacheAssembler = require('../../cache.assembler.js');

/* Constants and flags */
const APP_NAME = process.env.APP_NAME ? process.env.APP_NAME : 'tz-permissions';
const BUCKET_PREFIX = `BUCKET-${APP_NAME}`;
const MAX_RETRY_TIME = process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000;
const MAX_RETRY_ATTEMPTS = process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31;
const REDIS_RETRY_FREQ = process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000;
const REDIS_URL = process.env.REDISCLOUD_URL || process.env.REDIS_URL || 'redis://localhost:6379';

function sleep(ms) {
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

describe('CachedObject', async () => {
    let cacheableObject = require('./stubs/testClass.stub.js');

    let cacheFactory;
    let cachedObject;
    let hashFactory;
    let redisRWClient = createConnection();

    /* Promisified node redis methods */
    const existsAsync = promisify(redisRWClient.exists).bind(redisRWClient);
    const sendCommandAsync = promisify(redisRWClient.send_command).bind(redisRWClient);
    const scardAsync = promisify(redisRWClient.scard).bind(redisRWClient);
    const ttlAsync = promisify(redisRWClient.ttl).bind(redisRWClient);
    const smembersAsync = promisify(redisRWClient.smembers).bind(redisRWClient);
    const srandmemberAsync = promisify(redisRWClient.srandmember).bind(redisRWClient);

    before(async () => {
        cacheFactory = CacheAssembler.getCacheFactory();
        hashFactory = CacheAssembler.getHashFactory();
        cachedObject = await cacheFactory.cachify(cacheableObject);
        // Adding 5 seconds delay
        await sleep(5000);
    });
    beforeEach(async () => {
    });
    describe('#cachify', async () => {
        it('Throws an error when an non cacheable object is being cachified', async () => {
            class NonCacheable {}
            const nonCacheableObj = new NonCacheable();
            try {
                await cacheFactory.cachify(nonCacheableObj);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('The "cacheableObject" argument must be of type Class');
                return;
            }
            assert(false, 'Expected cacheFactory.cachify() to throw an exception');
        });
        it('Get a cached object from the cacher, no options.', async () => {
            assert.containsAllKeys(cachedObject, ['options', 'getOptions', 'name']);
        });
        describe('Returns the proper response.', async () => {
            it('Returns the expected response from the passthrough method.', async () => {
                let result = await cachedObject.passthroughMethod('world');
                expect(result).to.be.a('string');
                expect(result).to.contain('Passthrough: Hello world!');
            });
            it('Returns the expected response from the TTL method.', async () => {
                let result = await cachedObject.ttlMethod('world');
                expect(result).to.be.a('string');
                expect(result).to.contain('TTL: Hello world!');
            });
            it('Returns the expected response from the TTL with Buckets method.', async () => {
                let result = await cachedObject.ttlBucketsMethod('world');
                expect(result).to.be.a('string');
                expect(result).to.contain('TTL Buckets: Hello world!');
            });
            it('Returns the expected response from the Mutator method.', async () => {
                let result = await cachedObject.mutatorMethod('world');
                expect(result).to.be.a('string');
                expect(result).to.contain('Mutator: Hello world!');
            });
            it('Returns the expected response from the Unconfigured method.', async () => {
                let result = await cachedObject.unconfiguredMethod('world');
                expect(result).to.be.a('string');
                expect(result).to.contain('Unconfigured: Hello world!');
            });
        });

        describe('Runs when Redis is online!', async () => {
            beforeEach(async () => {
                // Flush the cache of all stored value
                if (redisRWClient.connected) {
                    await sendCommandAsync('FLUSHALL');
                }
            });
            afterEach(async () => {
                // Flush the cache of all stored value
                if (redisRWClient.connected) {
                    await sendCommandAsync('FLUSHALL');
                }
                // Adding 15 seconds delay
                // await sleep(15000);
            });
            it('Casher does not cache a passthrough method.', async () => {
                if (redisRWClient.connected) {
                    // Get the key
                    const key = hashFactory.create('TestClass', 'passthroughMethod', ['world']);
                    // Call the proxied method
                    let result = await cachedObject.passthroughMethod('world');
                    expect(result).to.contain('Passthrough: Hello world!');
                    // Check the cache to ensure the response was not stored
                    let val = await existsAsync(key);
                    expect(val).to.equal(0);
                }
            });
            it('Casher caches a TTL method.', async () => {
                if (redisRWClient.connected) {
                    // Get the key
                    const key = hashFactory.create('TestClass', 'ttlMethod', ['world']);
                    // Call the proxied method
                    let result = await cachedObject.ttlMethod('world');
                    expect(result).to.contain('TTL: Hello world!');
                    // Check the cache to ensure the response was stored
                    // console.log(key);
                    await sleep(500);
                    let val = await existsAsync(key);
                    expect(val).to.equal(1);
                    // console.log('Up to here!');
                    // Ensure that the value was cached with proper TTL
                    val = await ttlAsync(key);
                    expect(val).to.be.lt(cachedObject.options.methods[cachedObject.ttlMethod.name].ttl);
                    // Ensure the key was saved into the GLOBAL bucket
                    val = await scardAsync(`${BUCKET_PREFIX}-GLOBAL`);
                    expect(val).to.equal(1);
                    val = JSON.parse(await srandmemberAsync(`${BUCKET_PREFIX}-GLOBAL`));
                    assert.containsAllKeys(val, ['key', 'buckets']);
                    expect(val.key).to.equal(key);
                    // Ensure the key was saved into the cached object Default bucket
                    val = await scardAsync(`${BUCKET_PREFIX}-${cachedObject.options.buckets[0]}`);
                    expect(val).to.equal(1);
                    val = await srandmemberAsync(`${BUCKET_PREFIX}-${cachedObject.options.buckets[0]}`);
                    expect(val).to.equal(key);
                    // Ensure the key expires after configured timeout
                    await sleep(cachedObject.options.methods[cachedObject.ttlMethod.name].ttl * 1000);
                    // await sleep(500);
                    // console.log('Up to here!');
                    val = await existsAsync(key);
                    expect(val).to.equal(0);
                }
            }).timeout(90 * 1000);
            it('Cacher caches a TTL method with buckets.', async () => {
                if (redisRWClient.connected) {
                    // Get the key
                    const key = hashFactory.create('TestClass', 'ttlBucketsMethod', ['world']);
                    // console.log(key);
                    // Call the proxied method
                    let result = await cachedObject.ttlBucketsMethod('world');
                    // console.log(result);
                    expect(result).to.contain('TTL Buckets: Hello world!');
                    // Check the cache to ensure the response was stored
                    await sleep(500);
                    let val = await existsAsync(key);
                    // console.log(val);
                    expect(val).to.equal(1);
                    // Ensure that the value was cached with proper TTL
                    val = await ttlAsync(key);
                    // console.log(val);
                    expect(val).to.be.lt(cachedObject.options.methods[cachedObject.ttlBucketsMethod.name].ttl);
                    // Ensure the key was saved into the GLOBAL bucket
                    val = await scardAsync(`${BUCKET_PREFIX}-GLOBAL`);
                    // console.log(val);
                    expect(val).to.equal(1);
                    val = JSON.parse(await srandmemberAsync(`${BUCKET_PREFIX}-GLOBAL`));
                    // console.log(val);
                    assert.containsAllKeys(val, ['key', 'buckets']);
                    expect(val.key).to.equal(key);
                    // Ensure the key was saved into the specified buckets
                    const buckets = val.buckets;
                    for (let bucket of buckets) {
                        val = await scardAsync(`${BUCKET_PREFIX}-${bucket}`);
                        expect(val).to.equal(1);
                        val = await srandmemberAsync(`${BUCKET_PREFIX}-${bucket}`);
                        expect(val).to.equal(key);
                    }
                    // Ensure the key expires after configured timeout
                    await sleep(cachedObject.options.methods[cachedObject.ttlBucketsMethod.name].ttl * 1000);
                    val = await existsAsync(key);
                    // console.log(val);
                    expect(val).to.equal(0);
                }
            }).timeout(90 * 1000);
            it('Clears the keys associated with a bucket specified in a mutator method', async () => {
                if (redisRWClient.connected) {
                    /* Call the cached method */
                    let key = hashFactory.create('TestClass', 'ttlBucketsMethod', ['world']);
                    // Call the proxied cached method
                    let result = await cachedObject.ttlBucketsMethod('world');
                    // Check the cache to ensure the response was stored
                    await sleep(500);
                    let val = await existsAsync(key);
                    expect(val).to.equal(1);
                    val = JSON.parse(await smembersAsync(`${BUCKET_PREFIX}-GLOBAL`));
                    assert.containsAllKeys(val, ['key', 'buckets']);
                    /* Call the mutator method */
                    result = await cachedObject.mutatorMethod('world');
                    expect(result).to.be.a('string');
                    expect(result).to.contain('Mutator: Hello world!');
                    // Check the cache to ensure that the cached response was purged.
                    await sleep(500);
                    val = await existsAsync(key);
                    expect(val).to.equal(0);
                    // Ensure the key was deleted from the GLOBAL bucket
                    val = await scardAsync(`${BUCKET_PREFIX}-GLOBAL`);
                    expect(val).to.equal(0);
                    val = JSON.parse(await srandmemberAsync(`${BUCKET_PREFIX}-GLOBAL`));
                    expect(val).to.be.null;
                }
            }).timeout(90 * 1000);
            it('Caches the response of an unconfigured method', async () => {
                if (redisRWClient.connected) {
                    // Get the key
                    const key = hashFactory.create('TestClass', 'unconfiguredMethod', ['world']);
                    // Call the proxied method
                    let result = await cachedObject.unconfiguredMethod('world');
                    expect(result).to.contain('Unconfigured: Hello world!');
                    // Check the cache to ensure the response was stored
                    await sleep(500);
                    let val = await existsAsync(key);
                    expect(val).to.equal(1);
                    // result = await cachedObject.unconfiguredMethod('world');
                    // Ensure that the value was cached with proper TTL
                    val = await ttlAsync(key);
                    expect(val).to.be.lt(cachedObject.options.ttl);
                }
            }).timeout(90 * 1000);
            it('Check the cached value multiple times', async () => {
                if (redisRWClient.connected) {
                    // Call the proxied method
                    let result = await cachedObject.unconfiguredMethod('world');
                    expect(result).to.contain('Unconfigured: Hello world!');
                    // Call the proxied method
                    result = await cachedObject.unconfiguredMethod('world');
                    expect(result).to.contain('Unconfigured: Hello world!');
                    // Call the proxied method
                    result = await cachedObject.unconfiguredMethod('world');
                    expect(result).to.contain('Unconfigured: Hello world!');
                }
            }).timeout(90 * 1000);
        });
    });
});
