/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const CachedMethodHandler = require('../../methodHandlers/cachedMethod.handler.js');

// Stubs
const cacher = require('./stubs/cacher.stub.js');
const hashFactory = require('./stubs/hash.factory.stub.js');
const cachedObj = require('../fixtures/testClass.stub.js');

describe('CachedMethodHandler', () => {
    const cachedMethodHandler = new CachedMethodHandler(cacher, hashFactory);
    describe('#apply', () => {
        it('Throws an error when no argument is passed.', async () => {
            try {
                await cachedMethodHandler.apply();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Arguments, target and thisArg are required.');
                return;
            }
            assert(false, 'Expected cachedMethodHandler.apply() to throw an exception');
        });
        it('Returns a message based on parameters.', async () => {
            let result = await cachedMethodHandler.apply(cachedObj.testMethod, cachedObj, 'world');
            expect(result).to.be.a('string');
            expect(result).to.contain('Hello world!');
        });
        it('Returns a cached message based on parameters.', async () => {
            let result = await cachedMethodHandler.apply(cachedObj.testMethod, cachedObj, 'cached world');
            expect(result).to.be.a('string');
            expect(result).to.contain('Hello cached world!');
        });
        it('Returns an object based on parameters.', async () => {
            let result = await cachedMethodHandler.apply(cachedObj.testMethodObj, cachedObj, { message: 'Hello world!' });
            expect(result).to.be.an('object');
            expect(result.message).to.contain('Hello world!');
        });
        it('Returns an array based on parameters.', async () => {
            let result = await cachedMethodHandler.apply(cachedObj.testMethodArray, cachedObj, ['Hello', 'World']);
            expect(result).to.be.an('array');
            expect(result[0]).to.contain('Hello');
            expect(result[1]).to.contain('World');
        });
    });
});
