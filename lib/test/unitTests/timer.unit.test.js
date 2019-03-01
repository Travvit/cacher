/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const timer = require('../../utils/timer.js');

describe('Timer', () => {
    describe('#start', () => {
        it('Returns an array with the HR time.', async () => {
            let result = timer.start();
            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
            expect(result[0]).to.be.a('number');
            expect(result[1]).to.be.a('number');
        });
    });
    describe('#intervalHR', () => {
        it('Returns an array with the HR time.', async () => {
            let result = timer.intervalHR();
            expect(result).to.be.an('array');
            expect(result.length).to.equal(2);
            expect(result[0]).to.be.a('number');
            expect(result[1]).to.be.a('number');
        });
    });
    describe('#intervalMS', () => {
        it('Returns a number with the ms time', async () => {
            let result = timer.intervalMS();
            expect(result).to.be.a('number');
        });
    });
    describe('#sleep', () => {
        it('Returns a promise', async () => {
            let result = timer.sleep(5000);
            expect(result).to.be.a('promise');
            result.then((val) => {
                expect(val).to.be.true;
            });
        });
    });
});
