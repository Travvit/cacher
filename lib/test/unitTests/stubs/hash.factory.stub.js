const sinon = require('sinon');

// New stubs
const HashFactoryStub = {};

HashFactoryStub.create = sinon.stub();
HashFactoryStub.create
    .withArgs(undefined)
    .rejects(new Error('Method name is required for hashing'));
HashFactoryStub.create
    .withArgs('testMethod')
    .returns('79cd7d5840e381eaf66d7e3d4baca25c0c952a55');
HashFactoryStub.create
    .withArgs('testMethod', 'world')
    .returns('123456789');
HashFactoryStub.create
    .withArgs('TestClass', 'testMethod', 'world')
    .returns('123456789');
HashFactoryStub.create
    .withArgs(sinon.match.string, sinon.match.array)
    .returns('123456789');
HashFactoryStub.create
    .withArgs(sinon.match.string, sinon.match.string, sinon.match.array)
    .returns('123456789');
HashFactoryStub.create
    .withArgs(sinon.match.string, sinon.match.object)
    .returns('123456789');
HashFactoryStub.create
    .withArgs(sinon.match.string, sinon.match.string, sinon.match.object)
    .returns('123456789');

module.exports = HashFactoryStub;
