/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const Cacheable = require('../../cacheable.js');

describe('Cacheable', () => {
    const cacheable = new Cacheable();
    it('Gives an instance of a Cacheable', async () => {
        expect(cacheable.constructor.name).to.equal('Cacheable');
    });
    it('#getOptions', async () => {
        let result = await cacheable.getOptions();
        expect(result).to.be.undefined;
    });
});

