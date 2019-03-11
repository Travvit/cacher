/* eslint-disable global-require */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
// Load environment variables
// require('tz-config');

process.env.REDIS_MANAGER_ON = 'true';
process.env.REDIS_GC_ON = 'true';
process.env.NODE_ENV = 'development';
process.env.APP_NAME = 'tz-cacher-dev';
process.env.REDISCLOUD_URL = 'redis://localhost:6379';
// process.env.REDISCLOUD_URL = 'redis://rediscloud:H8vLg5rDpefM8vsCVwJzVW3aBIYV7kDE@redis-11742.c114.us-east-1-4.ec2.cloud.redislabs.com:11742';
// process.env.REDIS_URL = 'redis://h:p5a5ae4f1c205595206d051d525475a143bc4408a9b9c56dcf805c7fb4ad44a20@ec2-54-144-116-122.compute-1.amazonaws.com:6559';

const chai = require('chai').use(require('chai-as-promised'));

const { promisify } = require('util');

const { assert, expect } = chai;
const redis = require('redis');
const logger = require('tz-logger');
const _ = require('lodash');
// const { fork } = require('child_process');
// const path = require('path');
const EventEmitter = require('events');

// Load assembler
const CacheAssembler = require('../../cache.assembler.js');

/* Constants and flags */
const APP_NAME = process.env.APP_NAME ? process.env.APP_NAME : 'tz-permissions';
const NODE_ENV = process.env.NODE_ENV || 'development';
// const BUCKET_PREFIX = `BUCKET-${APP_NAME}`;
const MAX_RETRY_TIME = process.env.REDIS_MAX_RETRY_TIME ? parseInt(process.env.REDIS_MAX_RETRY_TIME, 10) : 30000;
const MAX_RETRY_ATTEMPTS = process.env.REDIS_MAX_RETRY_ATTEMPTS ? parseInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 10) : 31;
const REDIS_RETRY_FREQ = process.env.REDIS_RETRY_FREQ ? parseInt(process.env.REDIS_RETRY_FREQ, 10) : 1000;
let REDIS_URL = process.env.REDISCLOUD_URL || process.env.REDIS_URL || 'redis://localhost:6379';

function sleep(ms) {
    // console.log(`Waiting for ${ms} ms...`);
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

const bucketDeleteEmitter = new EventEmitter();

async function waitUntilGlobalBucketDelete() {
    return new Promise(async (resolve, reject) => {
        bucketDeleteEmitter.on('GLOBAL', () => {
            resolve('GLOBAL');
        });
    });
}

async function handleRedisMessage(channel, message) {
    // Respond to messages that relate to bucket deletion channel
    switch (channel) {
        case `${NODE_ENV}:bucket_del`:
            if (message.endsWith('GLOBAL')) {
                bucketDeleteEmitter.emit('GLOBAL');
            }
            break;
        default:
            break;
    }
    return true;
}

describe('CachedObjectFactory', () => {
    const cacheableObject = require('../fixtures/testClass.stub.js');
    const NonCacheable = require('../fixtures/nonCacheable.stub.js');
    const InvalidOptionsSchema = require('../fixtures/invalidOptionsSchema.stub.js');
    const DuplicateMethods = require('../fixtures/duplicateMethods.stub.js');
    const DefaultGlobalBucket = require('../fixtures/defaultGlobalBucket.stub.js');
    const MethodGlobalBucket = require('../fixtures/methodGlobalBucket.stub.js');

    let cachedObjectFactory;
    let cachedObject;
    let hashFactory;
    let redisRWClient = createConnection();
    let redisPSClient = createConnection();

    /* Promisified node redis methods */
    const existsAsync = promisify(redisRWClient.exists).bind(redisRWClient);
    const sendCommandAsync = promisify(redisRWClient.send_command).bind(redisRWClient);
    const scardAsync = promisify(redisRWClient.scard).bind(redisRWClient);
    const ttlAsync = promisify(redisRWClient.ttl).bind(redisRWClient);
    const srandmemberAsync = promisify(redisRWClient.srandmember).bind(redisRWClient);
    const keysAsync = promisify(redisRWClient.keys).bind(redisRWClient);

    /* Subscribe to key events */
    redisPSClient.subscribe(`${NODE_ENV}:bucket_del`);
    redisPSClient.on('message', handleRedisMessage.bind(this));

    before(async () => {
        cachedObjectFactory = CacheAssembler.getCachedObjectFactory({ app: 'tz-cacher-dev', env: NODE_ENV, hashFactoryName: 'AppEnv', storageName: 'Redis' });
        hashFactory = CacheAssembler.getHashFactory('AppEnv');
        cachedObject = await cachedObjectFactory.cachify(cacheableObject);
        // Adding 5 seconds delay
        await sleep(5000);
    });

    describe('#cachify', async () => {
        it('Throws an error when an non cacheable object is being cachified', async () => {
            const nonCacheableObj = new NonCacheable();
            try {
                await cachedObjectFactory.cachify(nonCacheableObj);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('The "cacheableObject" argument must be of type Cacheable');
                return;
            }
            assert(false, 'Expected cacheFactory.cachify() to throw an exception');
        });

        it('Throws an error when a cacheable object contains options that fails schema validation', async () => {
            const nonCacheableObj = new InvalidOptionsSchema();
            try {
                await cachedObjectFactory.cachify(nonCacheableObj);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('The caching options for InvalidOptionsSchema is incorrect! Reason: Cache options schema validation error!');
                return;
            }
            assert(false, 'Expected cacheFactory.cachify() to throw an exception');
        });

        it('Throws an error when a cacheable object contains options with duplicate method names', async () => {
            const nonCacheableObj = new DuplicateMethods();
            try {
                await cachedObjectFactory.cachify(nonCacheableObj);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('The caching options for DuplicateMethods is incorrect! Reason: Cache options cannot contain duplicate method names!');
                return;
            }
            assert(false, 'Expected cacheFactory.cachify() to throw an exception');
        });

        it('Throws an error when a cacheable object contains GLOBAL as the default bucket name', async () => {
            const nonCacheableObj = new DefaultGlobalBucket();
            try {
                await cachedObjectFactory.cachify(nonCacheableObj);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('The caching options for DefaultGlobalBucket is incorrect! Reason: Cache options cannot have \'GLOBAL\' as default bucket name!');
                return;
            }
            assert(false, 'Expected cacheFactory.cachify() to throw an exception');
        });

        it('Throws an error when a cacheable object contains GLOBAL as a bucket name for a cacheable method', async () => {
            const nonCacheableObj = new MethodGlobalBucket();
            try {
                await cachedObjectFactory.cachify(nonCacheableObj);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('The caching options for MethodGlobalBucket is incorrect! Reason: Cache options cannot have \'GLOBAL\' as method bucket name!');
                return;
            }
            assert(false, 'Expected cacheFactory.cachify() to throw an exception');
        });

        it('Get a cached object from the cacher, no options.', async () => {
            assert.containsAllKeys(cachedObject, ['options', 'name']);
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
                    await sleep(500);
                    let val = await existsAsync(key);
                    expect(val).to.equal(1);
                    // Ensure that the value was cached with proper TTL
                    val = await ttlAsync(key);
                    const foundMethod = _.find(cachedObject.options.methods, { name: cachedObject.ttlMethod.name });
                    expect(val).to.be.lt(foundMethod.ttl);
                    // Ensure the key was saved into the GLOBAL bucket
                    val = await scardAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.GLOBAL`);
                    expect(val).to.equal(1);
                    val = JSON.parse(await srandmemberAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.GLOBAL`));
                    assert.containsAllKeys(val, ['key', 'buckets']);
                    expect(val.key).to.equal(key);
                    // Ensure the key was saved into the cached object Default bucket
                    val = await scardAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.${cachedObject.options.buckets[0]}`);
                    expect(val).to.equal(1);
                    val = await srandmemberAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.${cachedObject.options.buckets[0]}`);
                    expect(val).to.equal(key);
                    // Ensure the key expires after configured timeout
                    await sleep(foundMethod.ttl * 1000);
                    // await sleep(500);
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
                    const foundMethod = _.find(cachedObject.options.methods, { name: cachedObject.ttlBucketsMethod.name });
                    expect(val).to.be.lt(foundMethod.ttl);
                    // Ensure the key was saved into the GLOBAL bucket
                    val = await scardAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.GLOBAL`);
                    // console.log(val);
                    expect(val).to.equal(1);
                    val = JSON.parse(await srandmemberAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.GLOBAL`));
                    // console.log(val);
                    assert.containsAllKeys(val, ['key', 'buckets']);
                    expect(val.key).to.equal(key);
                    // Ensure the key was saved into the specified buckets
                    const buckets = val.buckets;
                    let bucketAppNameTable = [];
                    let bucketApp = '';
                    let bucketName = '';
                    for (let bucket of buckets) {
                        // Check to see if an app name was specified
                        // console.log(bucket);
                        bucketAppNameTable = bucket.split('.');
                        // console.log(bucketAppNameTable);
                        if (bucketAppNameTable.length > 1) {
                            bucketApp = bucketAppNameTable[0];
                            bucketName = bucketAppNameTable[1];
                            // console.log(`App: ${bucketApp}, Bucket: ${bucketName}`);
                            if (bucketName === '*') {
                                // Find the list of buckets
                                // console.log(`Searching all buckets within app: ${bucketApp}, Bucket: BUCKET.development.${bucketApp}.${bucketName}`);
                                val = await keysAsync(`BUCKET.${NODE_ENV}.${bucketApp}.${bucketName}`);
                                // console.log(val);
                                for (let otherBucket of val) {
                                    // console.log(otherBucket);
                                    val = await scardAsync(otherBucket);
                                    expect(val).to.be.greaterThan(0);
                                }
                            } else {
                                val = await scardAsync(`BUCKET.${NODE_ENV}.${bucketApp}.${bucketName}`);
                                expect(val).to.be.greaterThan(0);
                            }
                        } else {
                            // console.log(`Bucket: ${bucket}`);
                            val = await scardAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.${bucket}`);
                            expect(val).to.equal(1);
                        }
                    }
                    // Ensure the key expires after configured timeout
                    await sleep(foundMethod.ttl * 1000);
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
                    result = await cachedObject.ttlBucketsMethod('worlds');
                    // Check the cache to ensure the response was stored
                    await sleep(500);
                    let val = await existsAsync(key);
                    expect(val).to.be.greaterThan(0);
                    /* Call the mutator method */
                    result = await cachedObject.mutatorMethod('world');
                    expect(result).to.be.a('string');
                    expect(result).to.contain('Mutator: Hello world!');
                    // Check the cache to ensure that the cached response was purged.
                    await sleep(500);
                    val = await existsAsync(key);
                    expect(val).to.equal(0);
                    // Ensure the key was deleted from the GLOBAL bucket
                    val = await scardAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.GLOBAL`);
                    expect(val).to.equal(0);
                    val = JSON.parse(await srandmemberAsync(`BUCKET.${NODE_ENV}.tz-cacher-dev.GLOBAL`));
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

    describe('Garbage collection', async () => {
        beforeEach(async () => {
            // Flush the cache of all stored value
            if (redisRWClient.connected) {
                await sendCommandAsync('FLUSHALL');
            }
        });

        after(() => {
            // process.exit();
        });

        it('Load a bunch of data and have them expired', async () => {
            if (redisRWClient.connected) {
                let result = await cachedObject.unconfiguredMethod('world');
                expect(result).to.contain('Unconfigured: Hello world!');
                await waitUntilGlobalBucketDelete();
                let val = await existsAsync(`BUCKET.${NODE_ENV}.${APP_NAME}.GLOBAL`);
                expect(val).to.equal(0);
            }
        }).timeout(300 * 1000);

        it('Load a bunch of data using TTL method and have them expired', async () => {
            if (redisRWClient.connected) {
                let result = await cachedObject.ttlMethod('world');
                expect(result).to.contain('TTL: Hello world!');
                await waitUntilGlobalBucketDelete();
                let val = await existsAsync(`BUCKET.${NODE_ENV}.${APP_NAME}.GLOBAL`);
                expect(val).to.equal(0);
            }
        }).timeout(300 * 1000);

        it('Load a bunch of data using TTL method with multiple buckets and have them expired', async () => {
            if (redisRWClient.connected) {
                let result = await cachedObject.ttlBucketsMethod('world');
                expect(result).to.contain('TTL Buckets: Hello world!');
                await waitUntilGlobalBucketDelete();
                let val = await existsAsync(`BUCKET.${NODE_ENV}.${APP_NAME}.GLOBAL`);
                expect(val).to.equal(0);
            }
        }).timeout(300 * 1000);
    });
});
