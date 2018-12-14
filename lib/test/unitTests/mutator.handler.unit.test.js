/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

const Cacheable = require('../../cacheable.js');

// Test Subject
const MutatorHandler = require('../../mutator.handler.js');

// Stubs
const cacher = require('./stubs/cacher.stub.js');

class TestClass extends Cacheable {
    constructor() {
        super();
        this.options = this.getOptions();
        this.cachedObject = this;
    }
    getOptions() {
        return {
            ttl: 100,
            buckets: ['test-bucket'],
            methods: {
                testMethod: {
                    buckets: ['test-bucket']
                },
                testMethodObj: {
                    buckets: ['test-bucket']
                },
                testMethodArray: {
                    buckets: ['test-bucket']
                }
            }
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

describe('MutatorHandler', () => {
    const mutatorHandler = new MutatorHandler(cacher);
    const mutatorObj = new TestClass();
    describe('#apply', () => {
        it('Throws an error when no argument is passed.', async () => {
            try {
                await mutatorHandler.apply();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Arguments, target and thisArg are required.');
                return;
            }
            assert(false, 'Expected mutatorHandler.apply() to throw an exception');
        });
        it('Returns a message based on parameters.', async () => {
            let result = await mutatorHandler.apply(mutatorObj.testMethod, mutatorObj, 'world');
            expect(result).to.be.a('string');
            expect(result).to.contain('Hello world!');
        });
        it('Returns an object based on parameters.', async () => {
            let result = await mutatorHandler.apply(mutatorObj.testMethodObj, mutatorObj, { message: 'Hello world!' });
            expect(result).to.be.an('object');
            expect(result.message).to.contain('Hello world!');
        });
        it('Returns an array based on parameters.', async () => {
            let result = await mutatorHandler.apply(mutatorObj.testMethodArray, mutatorObj, ['Hello', 'World']);
            expect(result).to.be.an('array');
            expect(result[0]).to.contain('Hello');
            expect(result[1]).to.contain('World');
        });
    });
});
