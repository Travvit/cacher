const _ = require('lodash');

/* Private methods */
const getAllMethodNames = Symbol('getAllMethodNames');
const checkCacheableObject = Symbol('checkCacheableObject');

/* Defaults */
const DEFAULTS = {
    ttl: 180, // The default global TTL for the object
    buckets: [],
    methods: {}, // A list of methods and how they need to be cached.
};

/**
 * This class allow the caching of any arbitrary objects. The class essentially caches the output of
 * a the member methods within a Cache server. The class only offers a constructor. All cache management
 * is performed using private members of this module and an options argument to the constructor.
 * `NOTE:` constructors are never cached.
 * @class
 * @param {object} cacheHandler the proxy object that handles the cached methods.
 * @param {object} passthroughHandler the proxy object that handles the passthrough methods.
 * @param {object} mutatorHandler the proxy object that handles the mutator methods.
 */
class CachedObject {
    constructor(cacheHandler, passthroughHandler, mutatorHandler) {
        this.cacheHandler = cacheHandler;
        this.passthroughHandler = passthroughHandler;
        this.mutatorHandler = mutatorHandler;
    }

    /**
     * Returns a new cachified object.
     * @param {*} cacheableObject the object being cached.
     * @returns {object} returns the cached version of the cacheableObject.
     */
    cachify(cacheableObject) {
        // Verify that you can cache the object.
        this[checkCacheableObject](cacheableObject);
        // Create a cachedObject and assign it the inherited properties.
        let cachedObject = _.assign({}, cacheableObject);
        cachedObject.name = cacheableObject.constructor.name;
        cachedObject.options = Object.assign({}, DEFAULTS, cacheableObject.getOptions());

        // Attach proxy handlers to the allowed methods of the cacheable object.
        let availableMethods = this[getAllMethodNames](cacheableObject);

        // Pass individual methods to proper handlers.
        for (let method of availableMethods) {
            if (cachedObject.options.methods[method]) {
                if (cachedObject.options.methods[method].passthrough) {
                    // Handle passthrough methods
                    cachedObject[method] = new Proxy(cacheableObject[method], this.passthroughHandler);
                } else if (cachedObject.options.methods[method].mutator) {
                    // Handle mutator methods
                    cachedObject[method] = new Proxy(cacheableObject[method], this.mutatorHandler);
                } else {
                    // Handle cached methods
                    cachedObject[method] = new Proxy(cacheableObject[method], this.cacheHandler);
                }
            } else {
                // Handle cached methods
                cachedObject[method] = new Proxy(cacheableObject[method], this.cacheHandler);
            }
        }
        return cachedObject;
    }

    /**
     * Returns a set of strings that correspond to the names of the own member methods of the object.
     * @param {*} obj the object being analyzed.
     * @returns {Array<string>} a list of the methods.
     */
    [getAllMethodNames](obj) {
        const methods = [];
        let keys = Reflect.ownKeys(Reflect.getPrototypeOf(obj));
        _.forEach(keys, (method, key) => {
            if (method !== 'constructor') methods.push(method);
        });
        return methods;
    }

    /**
     * This method ensures that the object being used is a javascript object.
     * @param {*} obj the object being tested.
     * @throws Will throw and `Error` if obj is anything other than an object.
     */
    [checkCacheableObject](obj) {
        if (Object.getPrototypeOf(obj.constructor).name !== 'Cacheable') {
            throw new Error('The "cacheableObject" argument must be of type Class');
        }
    }
}

module.exports = CachedObject;
