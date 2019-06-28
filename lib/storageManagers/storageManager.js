const EventEmitter = require('events');

/**
 * Abstract class that defines a cached object storage manager. A StorageManager is also an EventEmitter.
 */
class StorageManager extends EventEmitter {
    /**
     * This adds a name to the connection.
     * @param {*} options
     * @param {string} options.app the name of the app.
     * @param {string} options.env the name of the environment.
     * @param {string} options.instance the name of the instance.
     */
    constructor({ app, env, instance }) {
        super();
        this.app = app;
        this.env = env;
        this.instance = instance;
    }
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
     * @param {*} options
     */
    purgeBuckets(options) {}
}

module.exports = StorageManager;
