const sinon = require('sinon');

// New stubs
const HashFactoryStub = {};

HashFactoryStub.create = sinon.stub();
HashFactoryStub.create
    .withArgs(undefined)
    .rejects(new Error('Class name is required for hashing'));
HashFactoryStub.create
    .withArgs(sinon.match.string, undefined)
    .rejects(new Error('Method name is required for hashing'));
HashFactoryStub.create
    .withArgs('TestClass', 'testMethod', 'world')
    .returns('123456789');
HashFactoryStub.create
    .withArgs('TestClass', 'testMethod', 'cached world')
    .returns('cached123456789');
HashFactoryStub.create
    .withArgs(sinon.match.string, sinon.match.string, sinon.match.array)
    .returns('123456789');
HashFactoryStub.create
    .withArgs(sinon.match.string, sinon.match.string, sinon.match.object)
    .returns('123456789');

module.exports = HashFactoryStub;
