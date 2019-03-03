/* eslint-disable global-require */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
// Load environment variables
// require('tz-config');

process.env.REDIS_MANAGER_ON = 'true';
process.env.NODE_ENV = 'development';
process.env.APP_NAME = 'tz-cacher-dev';
process.env.REDISCLOUD_URL = 'redis://localhost:6379';

const chai = require('chai').use(require('chai-as-promised'));

const { promisify } = require('util');

const { assert, expect } = chai;
const redis = require('redis');
const logger = require('tz-logger');
const { fork } = require('child_process');
const path = require('path');

// Load assembler
const CacheAssembler = require('../../cache.assembler.js');

/* Constants and flags */
const APP_NAME = process.env.APP_NAME ? process.env.APP_NAME : 'tz-permissions';
const APP_ENV = process.env.NODE_ENV || 'development';
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

function startGC() {
    logger.debug('connecting to message bus process');
    let args = [];
    let execArgv = [
        '--inspect=9998'
    ];
    let nodeArgs = {
        env: Object.assign({}, process.env),
        execArgv
    };
    logger.debug(`${__dirname} starting child process`);
    let exPath = path.resolve(`${__dirname}/../../garbageCollectors/redisGarbageCollector.js`);
    return new Promise((resolve, reject) => {
        this.gcProcess = fork(exPath, args, nodeArgs);
        resolve(this.gcProcess);
    });
}

async function getGCMessage(gcProc) {
    return new Promise((resolve, reject) => {
        gcProc.on('message', (msg) => {
            resolve(msg);
        });
    });
}

describe('CachedObjectFactory', () => {
    let cacheableObject = require('../fixtures/testClass.stub.js');

    let cachedObjectFactory;
    let cachedObject;
    let hashFactory;
    let redisRWClient = createConnection();
    let redisPSClient = createConnection();

    let subProc;

    /* Promisified node redis methods */
    const existsAsync = promisify(redisRWClient.exists).bind(redisRWClient);
    const sendCommandAsync = promisify(redisRWClient.send_command).bind(redisRWClient);
    const scardAsync = promisify(redisRWClient.scard).bind(redisRWClient);
    const ttlAsync = promisify(redisRWClient.ttl).bind(redisRWClient);
    const smembersAsync = promisify(redisRWClient.smembers).bind(redisRWClient);
    const srandmemberAsync = promisify(redisRWClient.srandmember).bind(redisRWClient);
    const infoAsync = promisify(redisRWClient.info).bind(redisRWClient);
    const dbsizeAsync = promisify(redisRWClient.dbsize).bind(redisRWClient);
    const keysAsync = promisify(redisRWClient.keys).bind(redisRWClient);

    /* Subscribe to key events */
    let allBucketsDeleted = false;
    redisPSClient.psubscribe('__keyevent@0__:del'); // Key deleted
    redisPSClient.on('pmessage', async (pattern, channel, message) => {
        // Perform different actions based on the key event.
        switch (channel.match(/__keyevent@\d+__:(.+)/)[1]) {
            case 'del':
                if (message.endsWith('GLOBAL')) {
                    // this.eventEmitter.emit('bucket.deleted', message);
                    // console.log(message);
                    allBucketsDeleted = true;
                    break;
                }
                break;
            default:
                break;
        }
        return true;
    });

    before(async () => {
        cachedObjectFactory = CacheAssembler.getCachedObjectFactory({ app: 'tz-cacher-dev', env: APP_ENV, hashFactoryName: 'AppEnv', storageName: 'Redis' });
        hashFactory = CacheAssembler.getHashFactory('AppEnv');
        cachedObject = await cachedObjectFactory.cachify(cacheableObject);
        // Adding 5 seconds delay
        await sleep(5000);
    });

    describe('#cachify', async () => {
        it('Throws an error when an non cacheable object is being cachified', async () => {
            class NonCacheable {}
            const nonCacheableObj = new NonCacheable();
            try {
                await cachedObjectFactory.cachify(nonCacheableObj);
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
                    expect(val).to.be.lt(cachedObject.options.methods[cachedObject.ttlMethod.name].ttl);
                    // Ensure the key was saved into the GLOBAL bucket
                    val = await scardAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.GLOBAL`);
                    expect(val).to.equal(1);
                    val = JSON.parse(await srandmemberAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.GLOBAL`));
                    assert.containsAllKeys(val, ['key', 'buckets']);
                    expect(val.key).to.equal(key);
                    // Ensure the key was saved into the cached object Default bucket
                    val = await scardAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.${cachedObject.options.buckets[0]}`);
                    expect(val).to.equal(1);
                    val = await srandmemberAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.${cachedObject.options.buckets[0]}`);
                    expect(val).to.equal(key);
                    // Ensure the key expires after configured timeout
                    await sleep(cachedObject.options.methods[cachedObject.ttlMethod.name].ttl * 1000);
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
                    expect(val).to.be.lt(cachedObject.options.methods[cachedObject.ttlBucketsMethod.name].ttl);
                    // Ensure the key was saved into the GLOBAL bucket
                    val = await scardAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.GLOBAL`);
                    // console.log(val);
                    expect(val).to.equal(1);
                    val = JSON.parse(await srandmemberAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.GLOBAL`));
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
                                val = await keysAsync(`BUCKET.${APP_ENV}.${bucketApp}.${bucketName}`);
                                // console.log(val);
                                for (let otherBucket of val) {
                                    // console.log(otherBucket);
                                    val = await scardAsync(otherBucket);
                                    expect(val).to.be.greaterThan(0);
                                }
                            } else {
                                val = await scardAsync(`BUCKET.${APP_ENV}.${bucketApp}.${bucketName}`);
                                expect(val).to.be.greaterThan(0);
                            }
                        } else {
                            // console.log(`Bucket: ${bucket}`);
                            val = await scardAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.${bucket}`);
                            expect(val).to.equal(1);
                        }
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
                    val = await scardAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.GLOBAL`);
                    expect(val).to.equal(0);
                    val = JSON.parse(await srandmemberAsync(`BUCKET.${APP_ENV}.tz-cacher-dev.GLOBAL`));
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

    describe.only('Garbage collection', async () => {
        before(async () => {
            subProc = await startGC();
        });
        after(async () => {
            subProc.kill();
        });

        it('Receives the start message', async () => {
            let result = await getGCMessage(subProc);
            // logger.log(result);
            expect(result).to.contain('GC process started.');
        });

        it('Load a bunch of data and have them expired', async () => {
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
                logger.log(val);
                // wait for data to expire
                await sleep(30 * 1000);
                val = await existsAsync(key);
                expect(val).to.equal(0);
                await sleep(30 * 1000);
            }
        }).timeout(300 * 1000);
    });
});
