
/**
 * The `Cacher` object exposes some general mathods necessary to us a caching system.
 * This decouples the caching implementation from the general caching functions.
 * @class
 * @param {Object} an object that represents a cache manager, such as Redis.
 * The cache manager abstracts the inner functions of the caching client API.
 */
class Cacher {
    constructor(cacheManager) {
        this.cacheManager = cacheManager;
    }

    /**
     * Returns the cached value.
     * @param {string} key the key for the cached value.
     * @returns returns the cached value.
     */
    async getCachedValue(key) {
        return this.cacheManager.getCachedValue(key);
    }

    /**
     * Saves a given value into the cache with the associated key.
     * @param {string} cachedObject the name of the object.
     * @param {string} cachedMethod name of the method whos response is being cached.
     * @param {string} key the key for the cached value.
     * @param {*} value the cached value.
     * @param {number} ttl the TTL for the cached value.
     * @param {Array<string>} buckets a list of buckets.
     * @returns returns a response from the cache handler after the value is cached.
     */
    async setCachedValue(cachedObject, cachedMethod, key, value, ttl, buckets) {
        return this.cacheManager.setCachedValue(cachedObject, cachedMethod, key, value, ttl, buckets);
    }

    /**
     * Invalidates the keys from the associated buckets.
     * @param {Array<string>} buckets a list of buckets.
     * @returns {boolean} returns whether the buckets were purged or not.
     */
    async purgeBuckets(buckets) {
        return this.cacheManager.purgeBuckets(buckets);
    }
}

module.exports = Cacher;
