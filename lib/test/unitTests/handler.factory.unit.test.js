/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const HandlerFactory = require('../../handler.factory.js');

describe('HandlerFactory', () => {
    const handlerFactory = new HandlerFactory();
    it('#create', async () => {
        let result = await handlerFactory.create();
        expect(result).to.be.undefined;
    });
});
