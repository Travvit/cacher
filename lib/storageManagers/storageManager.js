const EventEmitter = require('events');

/**
 * Abstract class that defines a cached object storage manager. A StorageManager is also an EventEmitter.
 */
class StorageManager extends EventEmitter {
    /**
     * Method used to get a cached value based on the key provided.
     * @param {string} key
     */
    getCachedValue(key) {}

    /**
     * Method used to set a cachable value into storage.
     * @param {*} options
     */
    setCachedValue(options) {}

    /**
     * Purge the contents of the buckets and the associated keys from storage.
     * @param {*} buckets
     */
    purgeBuckets(buckets) {}
}

module.exports = StorageManager;
