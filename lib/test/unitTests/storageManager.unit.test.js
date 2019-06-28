/* eslint-disable max-len */
/* eslint-disable no-unused-expressions */
const chai = require('chai').use(require('chai-as-promised'));

const { expect, assert } = chai;

// Test Subject
const StorageManager = require('../../storageManagers/storageManager.js');

describe('StorageManager', () => {
    const storageManager = new StorageManager({ app: 'test-app', env: 'test-env', instance: 'test-instance' });
    it('Gives an instance of a StorageManager', async () => {
        expect(storageManager.constructor.name).to.equal('StorageManager');
    });
    it('Ensures a StorageManager is an event emitter', async () => {
        assert.containsAllKeys(storageManager, ['_events', '_eventsCount', '_maxListeners', 'app', 'env', 'instance']);
    });
    it('#getCachedValue', async () => {
        let result = await storageManager.getCachedValue();
        expect(result).to.be.undefined;
    });
    it('#setCachedValue', async () => {
        let result = await storageManager.setCachedValue();
        expect(result).to.be.undefined;
    });
    it('#purgeBuckets', async () => {
        let result = await storageManager.purgeBuckets();
        expect(result).to.be.undefined;
    });
});

