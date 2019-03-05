/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect } = chai;

// Test Subject
const GarbageCollector = require('../../garbageCollectors/garbageCollector.js');

describe('Cacheable', () => {
    const garbageCollector = new GarbageCollector();
    it('Gives an instance of a GarbageCollector', async () => {
        expect(garbageCollector.constructor.name).to.equal('GarbageCollector');
    });
});

