const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const HashFactory = require('../../factories/env.hash.factory.js');

describe('EnvHashFactory', () => {
    const factory = new HashFactory('tz-cacher-dev', 'development');
    describe('#create', () => {
        const hashWithMethodOnly = '1968ea55df4804e65bf25936d86377cbe34853cd';
        const hashWithMethodAndNullParam = 'fedb3fa3e700c1004b6fd43e60ed8a4a9cc71971';
        const hashWithMethodAndIntegerParam = '31dec32027267401c8debf0ad92c41d3db2aa6ca';
        const hashWithMethodAndStringParam = '5c317e1ed82e1fcab1af7e5b1502e494c49af141';
        const hashWithMethodAndArrayParam = 'ad32dd1a4122e65bd04654e78f1d0f8fd1a1fe05';
        const hashWithMethodAndObjectParam = 'e32c782698442f15495046edb20173e16cbe6758';

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
