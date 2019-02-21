const sinon = require('sinon');

// New stubs
const CacheManagerStub = {};

CacheManagerStub.getCachedValue = sinon.stub();
CacheManagerStub.getCachedValue
    .withArgs('REDIS_UNAVAILABLE')
    .rejects(new Error('Redis is not available.'));
CacheManagerStub.getCachedValue
    .withArgs(undefined)
    .rejects(new Error('Invalid key format!'));
CacheManagerStub.getCachedValue
    .withArgs(null)
    .rejects(new Error('Invalid key format!'));
CacheManagerStub.getCachedValue
    .withArgs('123456789')
    .returns(null);
CacheManagerStub.getCachedValue
    .withArgs('abcd1234')
    .returns('{"name":"tester","skill":95}');

CacheManagerStub.setCachedValue = sinon.stub();
CacheManagerStub.setCachedValue
    .withArgs(sinon.match.string, sinon.match.string, 'REDIS_UNAVAILABLE')
    .rejects(new Error('Redis is not available.'));
CacheManagerStub.setCachedValue
    .withArgs({ app: 'tz-cacher', env: 'development', key: undefined, cachedObject: undefined, cachedMethod: undefined, value: undefined, ttl: undefined, buckets: undefined })
    .rejects(new Error('Invalid key format!'));
// CacheManagerStub.setCachedValue
//     .withArgs(null)
//     .rejects(new Error('Invalid key format!'));
CacheManagerStub.setCachedValue
    .withArgs({ app: 'tz-cacher', env: 'development', key: 'testKey', cachedObject: 'TestClass', cachedMethod: 'testMethod', value: { name: 'tester', skill: 95 }, ttl: 500, buckets: ['test-bucket'] })
    .returns('OK');

CacheManagerStub.purgeBuckets = sinon.stub();
CacheManagerStub.purgeBuckets
    .withArgs('REDIS_UNAVAILABLE')
    .rejects(new Error('Redis is not available.'));
CacheManagerStub.purgeBuckets
    .withArgs(undefined)
    .rejects(new Error('Invalid buckets format!'));
CacheManagerStub.purgeBuckets
    .withArgs(null)
    .rejects(new Error('Invalid buckets format!'));
CacheManagerStub.purgeBuckets
    .withArgs(sinon.match.array)
    .returns(true);

module.exports = CacheManagerStub;
