/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const passthroughMethodHandlerFactory = require('../../factories/passthroughMethod.handler.factory.js');

describe('PassthroughMethodHandlerFactory', () => {
    const factory = passthroughMethodHandlerFactory.create();
    it('Get a PassthroughMethodHandler from the PassthroughHandlerFactory', async () => {
        expect(factory).to.be.an('object');
        expect(factory.constructor.name).to.equal('PassthroughMethodHandler');
    });
});
