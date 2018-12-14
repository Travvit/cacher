/**
 * Cache Handlers are proxy handlers for methods who's responses are cached.
 * @param {object} cacher
 * @param {object} hashFactory
 */
class CacheHandler {
    constructor(cacher, hashFactory) {
        this.cacher = cacher;
        this.hashFactory = hashFactory;
    }
    async apply(target, thisArg, argumentsList) {
        {
            // Ensure required arguments were passed
            if (target === undefined || target === null || thisArg === undefined || thisArg === null) {
                throw new Error('Arguments, target and thisArg are required.');
            }
            // Generated the hash key
            const key = this.hashFactory.create(target.name, argumentsList);
            // Check the cache and return if cache hit
            const cacheVal = await this.cacher.getCachedValue(key);
            if (cacheVal) {
                return JSON.parse(cacheVal);
            }
            // If cache miss, call method with the arguments
            let result;
            if (argumentsList instanceof Array) {
                result = await target.call(thisArg, ...argumentsList);
            } else {
                result = await target.call(thisArg, argumentsList);
            }
            // Check to see if custom ttl is specified, otherwise use the default.
            const ttl = thisArg.options.methods[target.name] && thisArg.options.methods[target.name].ttl ? thisArg.options.methods[target.name].ttl : thisArg.options.ttl;
            // Save the key into the specified buckets or the global buckets if none specified
            const buckets = thisArg.options.methods[target.name] && thisArg.options.methods[target.name].buckets ? thisArg.options.methods[target.name].buckets : thisArg.options.buckets;
            // Cache response from the method.
            this.cacher.setCachedValue(thisArg.name, target.name, key, result, ttl, buckets);
            return result;
        }
    }
}

module.exports = CacheHandler;
