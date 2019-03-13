/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const Cacher = require('../../cacher.js');

// Stubs
const CacheManagerStub = require('./stubs/cacheManager.stub.js');

/* Constants and flags */
const APP_NAME = 'tz-cacher';
/* The application envionment. */
const NODE_ENV = 'development';

describe('Cacher', () => {
    const cacher = new Cacher(APP_NAME, NODE_ENV, CacheManagerStub);
    describe('#getCachedValue', async () => {
        const invalidKey = '123456789';
        const validKey = 'abcd1234';

        it('Returns error when Redis is not available.', async () => {
            try {
                await cacher.getCachedValue('REDIS_UNAVAILABLE');
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Redis is not available.');
                return;
            }
            assert(false, 'Expected cacher.getCachedValue to throw an exception');
        });
        it('Returns error with undefined key.', async () => {
            try {
                await cacher.getCachedValue();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Invalid key format!');
                return;
            }
            assert(false, 'Expected cacher.getCachedValue to throw an exception');
        });
        it('Returns error with null key.', async () => {
            try {
                await cacher.getCachedValue(null);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Invalid key format!');
                return;
            }
            assert(false, 'Expected cacher.getCachedValue to throw an exception');
        });
        it('Returns null with invalid key.', async () => {
            const result = await cacher.getCachedValue(invalidKey);
            expect(result).to.be.null;
        });
        it('Returns valid data with valid key.', async () => {
            const result = await cacher.getCachedValue(validKey);
            expect(result).to.be.a('string');
            const data = JSON.parse(result);
            expect(data).to.be.an('object');
            assert.containsAllKeys(data, ['name', 'skill']);
        });
    });

    describe('#setCachedValue', async () => {
        it('Returns error when no arguments provided.', async () => {
            try {
                await cacher.setCachedValue();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Invalid key format!');
                return;
            }
            assert(false, 'Expected cacher.setCachedValue to throw an exception');
        });
        it('Returns error when null argument provided.', async () => {
            try {
                await cacher.setCachedValue(null);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Cannot destructure property `key` of \'undefined\' or \'null\'.');
                return;
            }
            assert(false, 'Expected cacher.setCachedValue to throw an exception');
        });
        it('Returns OK with valid parameters.', async () => {
            const result = await cacher.setCachedValue({ key: 'testKey', cachedObject: 'TestClass', cachedMethod: 'testMethod', value: { name: 'tester', skill: 95 }, ttl: 500, buckets: ['test-bucket'] });
            expect(result).to.be.a('string');
            expect(result).to.contain('OK');
        });
    });

    describe('#purgeBuckets', async () => {
        it('Returns error when Redis is not available.', async () => {
            try {
                await cacher.purgeBuckets('REDIS_UNAVAILABLE');
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Redis is not available.');
                return;
            }
            assert(false, 'Expected cacher.purgeBuckets to throw an exception');
        });
        it('Returns error when no arguments provided.', async () => {
            try {
                await cacher.purgeBuckets();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Invalid buckets format!');
                return;
            }
            assert(false, 'Expected cacher.purgeBuckets to throw an exception');
        });
        it('Returns error when null argument provided.', async () => {
            try {
                await cacher.purgeBuckets(null);
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Invalid buckets format!');
                return;
            }
            assert(false, 'Expected cacher.purgeBuckets to throw an exception');
        });
        it('Returns true with valid parameters.', async () => {
            const result = await cacher.purgeBuckets(['permissions']);
            expect(result).to.be.true;
        });
    });
});
