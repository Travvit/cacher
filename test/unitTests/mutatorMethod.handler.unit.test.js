/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const MutatorMethodHandler = require('../../lib/methodHandlers/mutatorMethod.handler.js');

// Stubs
const cacher = require('../fixtures/stubs/cacher.stub.js');
const mutatorObj = require('../fixtures/stubs/testClass.stub.js');

describe('MutatorMethodHandler', () => {
    const mutatorMethodHandler = new MutatorMethodHandler(cacher);
    describe('#apply', () => {
        it('Throws an error when no argument is passed.', async () => {
            try {
                await mutatorMethodHandler.apply();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Arguments, target and thisArg are required.');
                return;
            }
            assert(false, 'Expected mutatorMethodHandler.apply() to throw an exception');
        });
        it('Returns a message based on parameters.', async () => {
            let result = await mutatorMethodHandler.apply(mutatorObj.testMethod, mutatorObj, 'world');
            expect(result).to.be.a('string');
            expect(result).to.contain('Hello world!');
        });
        it('Returns an object based on parameters.', async () => {
            let result = await mutatorMethodHandler.apply(mutatorObj.testMethodObj, mutatorObj, { message: 'Hello world!' });
            expect(result).to.be.an('object');
            expect(result.message).to.contain('Hello world!');
        });
        it('Returns an array based on parameters.', async () => {
            let result = await mutatorMethodHandler.apply(mutatorObj.testMethodArray, mutatorObj, ['Hello', 'World']);
            expect(result).to.be.an('array');
            expect(result[0]).to.contain('Hello');
            expect(result[1]).to.contain('World');
        });
    });
});
