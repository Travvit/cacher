const sinon = require('sinon');

// New stubs
const CacheHandlerStub = {};

CacheHandlerStub.getCachedValue = sinon.stub();
CacheHandlerStub.apply
    .withArgs('REDIS_UNAVAILABLE')
    .rejects(new Error('Redis is not available.'));
CacheHandlerStub.apply
    .stub.returnsArg(3);

module.exports = CacheHandlerStub;
