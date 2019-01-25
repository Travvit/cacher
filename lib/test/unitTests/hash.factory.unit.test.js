const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const HashFactory = require('../../hash.factory.js');

describe('HashFactory', () => {
    const factory = new HashFactory('tz-cacher-dev', 'development');
    describe('#create', () => {
        const hashWithMethodOnly = '62804e8dab64596d6094f4abb610ed1747fc473f';
        const hashWithMethodAndNullParam = 'd5b8eebf18254586bc544b13d7ee8d66372ed524';
        const hashWithMethodAndIntegerParam = '19369509343afa733d2e5f95c2f375898c44b9f3';
        const hashWithMethodAndStringParam = '5e70d75141ef64cb9536a167b5d012fb718dc2b8';
        const hashWithMethodAndArrayParam = '3992aa4b92f8358e23d66ea35d8a1b59e62bbb35';
        const hashWithMethodAndObjectParam = 'aafb41a576e9a5662b7b782298e8cda08b60c8a9';

        it('Returns error when class name is missing.', async () => {
            try {
                await factory.create();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Class name is required for hashing');
                return;
            }
            assert(false, 'Expected factory.create to throw an exception');
        });

        it('Returns error when method name is missing.', async () => {
            try {
                await factory.create('TestClass');
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Method name is required for hashing');
                return;
            }
            assert(false, 'Expected factory.create to throw an exception');
        });

        it('Returns the expected hash value for a method only.', async () => {
            let result = factory.create('TestClass', 'testMethod');
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodOnly);
        });

        it('Returns the expected hash value for a method and null parameter value.', async () => {
            let result = factory.create('TestClass', 'testMethod', null);
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndNullParam);
        });

        it('Returns the expected hash value for a method and integer parameter value.', async () => {
            let result = factory.create('TestClass', 'testMethod', 1);
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndIntegerParam);
        });

        it('Returns the expected hash value for a method and string parameter value.', async () => {
            let result = factory.create('TestClass', 'testMethod', 'This is a test');
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndStringParam);
        });

        it('Returns the expected hash value for a method and array parameter value.', async () => {
            let result = factory.create('TestClass', 'testMethod', ['This is', ' a test']);
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndArrayParam);
        });

        it('Returns the expected hash value for a method and object parameter value.', async () => {
            let result = factory.create('TestClass', 'testMethod', { a: 'This is', b: ' a test' });
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndObjectParam);
        });
    });
});
