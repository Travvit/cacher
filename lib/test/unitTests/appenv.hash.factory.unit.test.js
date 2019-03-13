const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const HashFactory = require('../../factories/appenv.hash.factory.js');

describe('AppEnvHashFactory', () => {
    const factory = new HashFactory('tz-cacher-dev', 'development');
    describe('#create', () => {
        const hashWithMethodOnly = 'e10128314fca3398bf60d76afdfda4a960db2753';
        const hashWithMethodAndNullParam = 'f72c1ecd6022fc67545e302acf3466be987c2f26';
        const hashWithMethodAndIntegerParam = '3b2f29e19a5d011bff7109da44d628403456683c';
        const hashWithMethodAndStringParam = '6f4945f03fd2d860320f21b2653602b66573bccd';
        const hashWithMethodAndArrayParam = 'b0d513bc22e9bea35b202ceca2eb64fb9943d244';
        const hashWithMethodAndObjectParam = 'f4b593655a6725520c54c4e021b52e4799054c28';

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
