const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const Factory = require('../../factories/factory.js');

describe('Factory', () => {
    const factory = new Factory();
    it('Gives an instance of a Factory', async () => {
        expect(factory.constructor.name).to.equal('Factory');
    });
    it('#create', async () => {
        let result = await factory.create();
        expect(result).to.be.undefined;
    });
});
