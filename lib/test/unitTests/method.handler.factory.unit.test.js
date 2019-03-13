const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const MethodHandlerFactory = require('../../factories/method.handler.factory.js');

describe('MethodHandlerFactory', () => {
    const methodHandlerFactory = new MethodHandlerFactory();
    it('Gives an instance of a Factory', async () => {
        expect(methodHandlerFactory.constructor.name).to.equal('MethodHandlerFactory');
    });
    it('#create', async () => {
        let result = await methodHandlerFactory.create();
        expect(result).to.be.undefined;
    });
});
