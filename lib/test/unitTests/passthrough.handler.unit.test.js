/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

const Cacheable = require('../../cacheable.js');

// Test Subject
const PassthroughHandler = require('../../passthrough.handler.js');

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

describe('PassthroughHandler', () => {
    const passthroughHandler = new PassthroughHandler();
    const passthroughObj = new TestClass();
    describe('#apply', () => {
        it('Throws an error when no argument is passed.', async () => {
            try {
                await passthroughHandler.apply();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Arguments, target and thisArg are required.');
                return;
            }
            assert(false, 'Expected passthroughHandler.apply() to throw an exception');
        });
        it('Returns a message based on parameters.', async () => {
            let result = await passthroughHandler.apply(passthroughObj.testMethod, passthroughObj, 'world');
            expect(result).to.be.a('string');
            expect(result).to.contain('Hello world!');
        });
        it('Returns an object based on parameters.', async () => {
            let result = await passthroughHandler.apply(passthroughObj.testMethodObj, passthroughObj, { message: 'Hello world!' });
            expect(result).to.be.an('object');
            expect(result.message).to.contain('Hello world!');
        });
        it('Returns an array based on parameters.', async () => {
            let result = await passthroughHandler.apply(passthroughObj.testMethodArray, passthroughObj, ['Hello', 'World']);
            expect(result).to.be.an('array');
            expect(result[0]).to.contain('Hello');
            expect(result[1]).to.contain('World');
        });
    });
});
