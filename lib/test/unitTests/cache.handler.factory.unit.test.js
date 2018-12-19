/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const cacheHandlerFactory = require('../../cache.handler.factory.js');

// Stubs
const cacher = require('./stubs/cacher.stub.js');
const hashFactory = require('./stubs/hash.factory.stub.js');

describe('CacheHandlerFactory', () => {
    const factory = cacheHandlerFactory.create(cacher, hashFactory);
    it('Get a CacheHandler from the CacheHandlerFactory', async () => {
        expect(factory).to.be.an('object');
        assert.containsAllKeys(factory, ['cacher', 'hashFactory']);
        expect(factory.constructor.name).to.equal('CacheHandler');
    });
});
