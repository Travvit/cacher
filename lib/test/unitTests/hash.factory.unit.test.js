const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const HashFactory = require('../../factories/hash.factory.js');

describe('HashFactory', () => {
    const hashFactory = new HashFactory();
    it('#create', async () => {
        let result = await hashFactory.create();
        expect(result).to.be.undefined;
    });
});
