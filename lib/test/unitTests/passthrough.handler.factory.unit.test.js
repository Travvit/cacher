/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const passthroughHandlerFactory = require('../../passthrough.handler.factory.js');

describe('PassthroughHandlerFactory', () => {
    const factory = passthroughHandlerFactory.create();
    it('Get a PassthroughHandler from the PassthroughHandlerFactory', async () => {
        expect(factory).to.be.an('object');
        expect(factory.constructor.name).to.equal('PassthroughHandler');
    });
});
