/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const cachedMethodHandlerFactory = require('../../lib/factories/cachedMethod.handler.factory.js');

// Stubs
const cacher = require('../fixtures/stubs/cacher.stub.js');
const hashFactory = require('../fixtures/stubs/hash.factory.stub.js');

describe('CacheHandlerFactory', () => {
    const factory = cachedMethodHandlerFactory.create(cacher, hashFactory);
    it('Get a CachedMethodHandler from the CachedMethodHandlerFactory', async () => {
        expect(factory).to.be.an('object');
        assert.containsAllKeys(factory, ['cacher', 'hashFactory']);
        expect(factory.constructor.name).to.equal('CachedMethodHandler');
    });
});
