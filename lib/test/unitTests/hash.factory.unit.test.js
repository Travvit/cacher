const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const HashFactory = require('../../factories/hash.factory.js');

describe('HashFactory', () => {
    const hashFactory = new HashFactory();
    it('Gives an instance of a Factory', async () => {
        expect(hashFactory.constructor.name).to.equal('HashFactory');
    });
    it('#create', async () => {
        let result = await hashFactory.create();
        expect(result).to.be.undefined;
    });
});
