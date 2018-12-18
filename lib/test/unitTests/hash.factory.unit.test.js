const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const HashFactory = require('../../hash.factory.js');

describe('HashFactory', () => {
    const factory = new HashFactory('tz-cacher-dev', 'development');
    describe('#create', () => {
        const hashWithMethodOnly = '5042deb61b2fccac09f4f6ed26e669d5ad36679c';
        const hashWithMethodAndNullParam = 'dc1918ba1df926d4f58c33de71a4170c259be8cc';
        const hashWithMethodAndIntegerParam = 'c4f66242478598fd330df2c608ef0aa9b26b3b9a';
        const hashWithMethodAndStringParam = '4aa60b912a4442050e4b421378ad750c30438865';
        const hashWithMethodAndArrayParam = 'a772a0897bc5b40de6096651016fc857944004d7';
        const hashWithMethodAndObjectParam = '503204fb4664dca94a70b7cfa8623b25964ad7f2';

        it('Returns error when method name is missing.', async () => {
            try {
                await factory.create();
            } catch (error) {
                expect(error).to.be.an('error');
                expect(error.message).to.contain('Method name is required for hashing');
                return;
            }
            assert(false, 'Expected factory.create to throw an exception');
        });

        it('Returns the expected hash value for a method only.', async () => {
            let result = factory.create('testMethod');
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodOnly);
        });

        it('Returns the expected hash value for a method and null parameter value.', async () => {
            let result = factory.create('testMethod', null);
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndNullParam);
        });

        it('Returns the expected hash value for a method and integer parameter value.', async () => {
            let result = factory.create('testMethod', 1);
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndIntegerParam);
        });

        it('Returns the expected hash value for a method and string parameter value.', async () => {
            let result = factory.create('testMethod', 'This is a test');
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndStringParam);
        });

        it('Returns the expected hash value for a method and array parameter value.', async () => {
            let result = factory.create('testMethod', ['This is', ' a test']);
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndArrayParam);
        });

        it('Returns the expected hash value for a method and object parameter value.', async () => {
            let result = factory.create('testMethod', { a: 'This is', b: ' a test' });
            expect(result).to.be.a('string');
            expect(result).to.equal(hashWithMethodAndObjectParam);
        });
    });
});
