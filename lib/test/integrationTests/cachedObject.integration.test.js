/* eslint-disable no-await-in-loop */
// Load environment variables
const configVars = require('../../../configvar.json');
const localConfigVars = require('../../../env.local.json');

Object.assign(process.env, configVars, localConfigVars);

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
const NODE_ENV = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
const REDIS_URL = (NODE_ENV !== 'development') && (process.env.REDIS_URL) ? process.env.REDIS_URL : '';
const REDIS_HOST = (NODE_ENV !== 'development') && (process.env.REDIS_HOST) ? process.env.REDIS_HOST : 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? process.env.REDIS_PORT : 6379;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function createConnection() {
    return (NODE_ENV !== 'development') ? redis.createClient(REDIS_URL) : redis.createClient({
        host: REDIS_HOST,
        port: REDIS_PORT,
        retry_strategy(options) {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                // End reconnecting on a specific error and flush all commands with
                // a individual error
                logger.error('The server refused the connection');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                // End reconnecting after a specific timeout and flush all commands
                // with a individual error
                logger.error('Retry time exhausted');
            }
            if (options.attempt > 10) {
                // End reconnecting with built in error
                return undefined;
            }
            // reconnect after
            return Math.min(options.attempt * 100, 3000);
        }
    });
}

let CacheFactory;
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

describe('CachedObject', async () => {
    let cacheableObject = require('./stubs/testClass.stub.js');

    before(async () => {
        CacheFactory = CacheAssembler.getCacheFactory();
        hashFactory = CacheAssembler.getHashFactory();
        cachedObject = await CacheFactory.cachify(cacheableObject);
    });
    beforeEach(async () => {
    });
    describe('#cachify', async () => {
        it('Throws an error when an non cacheable object is being cachified', async () => {
            class NonCacheable {}
            const nonCacheableObj = new NonCacheable();
            try {
                await CacheFactory.cachify(nonCacheableObj);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('The "cacheableObject" argument must be of type Class');
                return;
            }
            assert(false, 'Expected CacheFactory.cachify() to throw an exception');
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
                    const key = hashFactory.create('passthroughMethod', ['world']);
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
                    const key = hashFactory.create('ttlMethod', ['world']);
                    // Call the proxied method
                    let result = await cachedObject.ttlMethod('world');
                    expect(result).to.contain('TTL: Hello world!');
                    // Check the cache to ensure the response was stored
                    let val = await existsAsync(key);
                    expect(val).to.equal(1);
                    // Ensure that the value was cached with proper TTL
                    val = await ttlAsync(key);
                    expect(val).to.equal(cachedObject.options.methods[cachedObject.ttlMethod.name].ttl);
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
                    val = await existsAsync(key);
                    expect(val).to.equal(0);
                }
            });
            it('Cacher caches a TTL method with buckets.', async () => {
                if (redisRWClient.connected) {
                    // Get the key
                    const key = hashFactory.create('ttlBucketsMethod', ['world']);
                    // Call the proxied method
                    let result = await cachedObject.ttlBucketsMethod('world');
                    expect(result).to.contain('TTL Buckets: Hello world!');
                    // Check the cache to ensure the response was stored
                    let val = await existsAsync(key);
                    expect(val).to.equal(1);
                    // Ensure that the value was cached with proper TTL
                    val = await ttlAsync(key);
                    expect(val).to.equal(cachedObject.options.methods[cachedObject.ttlBucketsMethod.name].ttl);
                    // Ensure the key was saved into the GLOBAL bucket
                    val = await scardAsync(`${BUCKET_PREFIX}-GLOBAL`);
                    expect(val).to.equal(1);
                    val = JSON.parse(await srandmemberAsync(`${BUCKET_PREFIX}-GLOBAL`));
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
                    expect(val).to.equal(0);
                }
            });
            it('Clears the keys associated with a bucket specified in a mutator method', async () => {
                if (redisRWClient.connected) {
                    /* Call the cached method */
                    let key = hashFactory.create('ttlBucketsMethod', ['world']);
                    // Call the proxied cached method
                    let result = await cachedObject.ttlBucketsMethod('world');
                    // Check the cache to ensure the response was stored
                    let val = await existsAsync(key);
                    expect(val).to.equal(1);
                    val = JSON.parse(await smembersAsync(`${BUCKET_PREFIX}-GLOBAL`));
                    assert.containsAllKeys(val, ['key', 'buckets']);
                    /* Call the mutator method */
                    result = await cachedObject.mutatorMethod('world');
                    expect(result).to.be.a('string');
                    expect(result).to.contain('Mutator: Hello world!');
                    // Check the cache to ensure that the cached response was purged.
                    val = await existsAsync(key);
                    expect(val).to.equal(0);
                    // Ensure the key was deleted from the GLOBAL bucket
                    val = await scardAsync(`${BUCKET_PREFIX}-GLOBAL`);
                    expect(val).to.equal(0);
                    val = JSON.parse(await srandmemberAsync(`${BUCKET_PREFIX}-GLOBAL`));
                    expect(val).to.be.null;
                }
            });
            it('Caches the response of an unconfigured method', async () => {
                if (redisRWClient.connected) {
                    // Get the key
                    const key = hashFactory.create('unconfiguredMethod', ['world']);
                    // Call the proxied method
                    let result = await cachedObject.unconfiguredMethod('world');
                    expect(result).to.contain('Unconfigured: Hello world!');
                    // Check the cache to ensure the response was stored
                    let val = await existsAsync(key);
                    expect(val).to.equal(1);
                    // result = await cachedObject.unconfiguredMethod('world');
                    // Ensure that the value was cached with proper TTL
                    val = await ttlAsync(key);
                    expect(val).to.equal(cachedObject.options.ttl);
                }
            });
        });
    });
});
