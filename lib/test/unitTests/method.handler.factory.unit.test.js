const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const MethodHandlerFactory = require('../../factories/method.handler.factory.js');

describe('MethodHandlerFactory', () => {
    const methodHandlerFactory = new MethodHandlerFactory();
    it('#create', async () => {
        let result = await methodHandlerFactory.create();
        expect(result).to.be.undefined;
    });
});
