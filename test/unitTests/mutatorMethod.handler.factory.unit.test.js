/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const mutatorMethodHandlerFactory = require('../../lib/factories/mutatorMethod.handler.factory.js');

// Stubs
const cacher = require('../fixtures/stubs/cacher.stub.js');

describe('MutatorMethodHandlerFactory', () => {
    const factory = mutatorMethodHandlerFactory.create(cacher);
    it('Get a MutatorMethodHandler from the MutatorMethodHandlerFactory', async () => {
        expect(factory).to.be.an('object');
        expect(factory.constructor.name).to.equal('MutatorMethodHandler');
        assert.containsAllKeys(factory, ['cacher']);
    });
});
