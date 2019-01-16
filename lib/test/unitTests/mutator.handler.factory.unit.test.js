/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const mutatorHandlerFactory = require('../../mutator.handler.factory.js');

// Stubs
const cacher = require('./stubs/cacher.stub.js');

describe('MutatorHandlerFactory', () => {
    const factory = mutatorHandlerFactory.create(cacher);
    it('Get a MutatorHandler from the MutatorHandlerFactory', async () => {
        expect(factory).to.be.an('object');
        expect(factory.constructor.name).to.equal('MutatorHandler');
        assert.containsAllKeys(factory, ['cacher']);
    });
});
