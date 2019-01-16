/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

const Cacheable = require('../../cacheable.js');

// Test Subject
const CacheHandler = require('../../cache.handler.js');

// Stubs
const cacher = require('./stubs/cacher.stub.js');
const hashFactory = require('./stubs/hash.factory.stub.js');

class TestClass extends Cacheable {
    constructor() {
        super();
        this.name = 'TestClass';
        this.options = this.getOptions();
    }
    getOptions() {
        return {
            ttl: 100,
            buckets: ['test-bucket'],
            methods: {}
        };
    }
    testMethod(name) {
        return `Hello ${name}!`;
    }
    testMethodObj(obj) {
        return obj;
    }
    testMethodArray(...obj) {
        return obj;
    }
}

describe('CacheHandler', () => {
    const cacheHandler = new CacheHandler(cacher, hashFactory);
    const cachedObj = new TestClass();
    describe('#apply', () => {
        it('Throws an error when no argument is passed.', async () => {
            try {
                await cacheHandler.apply();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Arguments, target and thisArg are required.');
                return;
            }
            assert(false, 'Expected cacheHandler.apply() to throw an exception');
        });
        it('Returns a message based on parameters.', async () => {
            let result = await cacheHandler.apply(cachedObj.testMethod, cachedObj, 'world');
            expect(result).to.be.a('string');
            expect(result).to.contain('Hello world!');
        });
        it('Returns an object based on parameters.', async () => {
            let result = await cacheHandler.apply(cachedObj.testMethodObj, cachedObj, { message: 'Hello world!' });
            expect(result).to.be.an('object');
            expect(result.message).to.contain('Hello world!');
        });
        it('Returns an array based on parameters.', async () => {
            let result = await cacheHandler.apply(cachedObj.testMethodArray, cachedObj, ['Hello', 'World']);
            expect(result).to.be.an('array');
            expect(result[0]).to.contain('Hello');
            expect(result[1]).to.contain('World');
        });
    });
});
