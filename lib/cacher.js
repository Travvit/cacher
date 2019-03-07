/* Constants and flags */
const APP_NAME = process.env.APP_NAME || 'tz-cacher';
/* The application envionment. */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * The `Cacher` object exposes some general mathods necessary to us a caching system.
 * This decouples the caching implementation from the general caching functions.
 * @class
 * @param {string} app the name of the app.
 * @param {string} env the environment.
 * @param {*} storageManager an object that represents a cache manager, such as Redis.
 * The cache manager abstracts the inner functions of the caching client API.
 */
class Cacher {
    constructor(app, env, storageManager) {
        this.APP_NAME = app || APP_NAME;
        this.NODE_ENV = env || NODE_ENV;
        this.storageManager = storageManager;
    }

    /**
     * Returns the cached value.
     * @param {string} key the key for the cached value.
     * @returns returns the cached value.
     */
    async getCachedValue(key) {
        return this.storageManager.getCachedValue(key);
    }

    /**
     * Saves a given value into the cache with the associated key.
     * @param {*} options
     * @param {string} options.key the key for the cached value.
     * @param {string} options.cachedObject the name of the object.
     * @param {string} options.cachedMethod name of the method whos response is being cached.
     * @param {*} options.value the cached value.
     * @param {number} options.ttl the TTL for the cached value.
     * @param {Array<string>} options.buckets a list of buckets.
     * @returns {*} returns a response from the cache handler after the value is cached.
     */
    async setCachedValue({ key, cachedObject, cachedMethod, value, ttl, buckets } = {}) {
        return this.storageManager.setCachedValue({ app: this.APP_NAME, env: this.NODE_ENV, key, cachedObject, cachedMethod, value, ttl, buckets });
    }

    /**
     * Invalidates the keys from the associated buckets.
     * @param {Array<string>} buckets a list of buckets.
     * @returns {boolean} returns whether the buckets were purged or not.
     */
    async purgeBuckets(buckets) {
        return this.storageManager.purgeBuckets({ app: this.APP_NAME, env: this.NODE_ENV, buckets });
    }
}

module.exports = Cacher;
