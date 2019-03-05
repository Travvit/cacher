/**
 * Cached Method Handlers are proxy handlers for methods who's responses are cached.
 * @class
 * @alias CachedMethodHandler
 * @param {*} cacher the cacher used to cache the method responses.
 * @param {*} hashFactory the method that generates the key for the cached value.
 */
class CachedMethodHandler {
    constructor(cacher, hashFactory) {
        this.cacher = cacher;
        this.hashFactory = hashFactory;
    }

    /**
     * This method abstracts the cached method call.
     * @param {*} target the cached method.
     * @param {*} thisArg the object who's method is cached.
     * @param {*} argumentsList the list of arguments passed to the cached method.
     * @returns the result of the cached method.
     */
    async apply(target, thisArg, argumentsList) {
        // Ensure required arguments were passed
        if (target === undefined || target === null || thisArg === undefined || thisArg === null) {
            throw new Error('Arguments, target and thisArg are required.');
        }
        // Generated the hash key
        const methodName = target.name;
        const className = thisArg.name || thisArg.constructor.name;
        const key = this.hashFactory.create(className, methodName, argumentsList);
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
        this.cacher.setCachedValue({ cachedObject: thisArg.name, cachedMethod: target.name, key, value: result, ttl, buckets });
        return result;
    }
}

module.exports = CachedMethodHandler;
