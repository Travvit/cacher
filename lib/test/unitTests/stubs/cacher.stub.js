const sinon = require('sinon');

// New stubs
const CacherStub = {};

CacherStub.getCachedValue = sinon.stub();
CacherStub.getCachedValue
    .withArgs('REDIS_UNAVAILABLE')
    .rejects(new Error('Redis is not available.'));
CacherStub.getCachedValue
    .withArgs(undefined)
    .rejects(new Error('Invalid key format!'));
CacherStub.getCachedValue
    .withArgs(null)
    .rejects(new Error('Invalid key format!'));
CacherStub.getCachedValue
    .withArgs('123456789')
    .returns(null);
CacherStub.getCachedValue
    .withArgs('abcd1234')
    .returns('{"name":"tester","skill":95}');

CacherStub.setCachedValue = sinon.stub();
CacherStub.setCachedValue
    .withArgs('REDIS_UNAVAILABLE')
    .rejects(new Error('Redis is not available.'));
CacherStub.setCachedValue
    .withArgs(undefined)
    .rejects(new Error('Invalid key format!'));
CacherStub.setCachedValue
    .withArgs(null)
    .rejects(new Error('Invalid key format!'));
CacherStub.setCachedValue
    .withArgs('TestClass', 'testMethod', 'testKey', sinon.match.object, sinon.match.number, sinon.match.any)
    .returns('OK');
CacherStub.setCachedValue
    .withArgs('TestClass', 'testMethod', '123456789', sinon.match.any, sinon.match.number, sinon.match.any)
    .returns('OK');

CacherStub.purgeBuckets = sinon.stub();
CacherStub.purgeBuckets
    .withArgs('REDIS_UNAVAILABLE')
    .rejects(new Error('Redis is not available.'));
CacherStub.purgeBuckets
    .withArgs(undefined)
    .rejects(new Error('Invalid buckets format!'));
CacherStub.purgeBuckets
    .withArgs(null)
    .rejects(new Error('Invalid buckets format!'));
CacherStub.purgeBuckets
    .withArgs(sinon.match.array)
    .returns(true);

module.exports = CacherStub;
