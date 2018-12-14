const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const HashFactory = require('../../hash.factory.js');

describe('HashFactory', () => {
    const factory = new HashFactory('tz-permissions-dev', 'development');
    describe('#create', () => {
        const hashWithMethodOnly = '79cd7d5840e381eaf66d7e3d4baca25c0c952a55';
        const hashWithMethodAndNullParam = '51e91ecbe83bc425aaf9f56074492332b48279ad';
        const hashWithMethodAndIntegerParam = 'b27145ac0e43ae1467aa889302287aa9eb7de997';
        const hashWithMethodAndStringParam = '6c94efb748341a1c12a255189615f7390460c09c';
        const hashWithMethodAndArrayParam = 'fcf83dcd306aad98f50b07c5e2ab115669b36f05';
        const hashWithMethodAndObjectParam = '8cdf16ac5d6a0c73f43a730492869ed3fec4f38b';

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
