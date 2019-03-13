/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const PassthroughMethodHandler = require('../../methodHandlers/passthroughMethod.handler.js');
const passthroughObj = require('../fixtures/testClass.stub.js');

describe('PassthroughMethodHandler', () => {
    const passthroughMethodHandler = new PassthroughMethodHandler();
    // const passthroughObj = new TestClass();
    describe('#apply', () => {
        it('Throws an error when no argument is passed.', async () => {
            try {
                await passthroughMethodHandler.apply();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Arguments, target and thisArg are required.');
                return;
            }
            assert(false, 'Expected passthroughMethodHandler.apply() to throw an exception');
        });
        it('Returns a message based on parameters.', async () => {
            let result = await passthroughMethodHandler.apply(passthroughObj.testMethod, passthroughObj, 'world');
            expect(result).to.be.a('string');
            expect(result).to.contain('Hello world!');
        });
        it('Returns an object based on parameters.', async () => {
            let result = await passthroughMethodHandler.apply(passthroughObj.testMethodObj, passthroughObj, { message: 'Hello world!' });
            expect(result).to.be.an('object');
            expect(result.message).to.contain('Hello world!');
        });
        it('Returns an array based on parameters.', async () => {
            let result = await passthroughMethodHandler.apply(passthroughObj.testMethodArray, passthroughObj, ['Hello', 'World']);
            expect(result).to.be.an('array');
            expect(result[0]).to.contain('Hello');
            expect(result[1]).to.contain('World');
        });
    });
});
