
const Factory = require('./factory.js');
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
 * @param {*} cacher the wrapper for the cacher object.
 * @param {*} hashFactory the hash factory.
 * @param {*} cacheHandlerFactory the factory to create a cacheHandler.
 * @param {*} passthroughHandlerFactory the factory to create a passthroughHandler.
 * @param {*} mutatorHandlerFactory the factory to create a mutatorHandler.
 */
class CachedObjectFactory extends Factory {
    constructor(cacher, hashFactory, cacheHandlerFactory, passthroughHandlerFactory, mutatorHandlerFactory) {
        super();
        this.cacher = cacher;
        this.hashFactory = hashFactory;
        this.cacheHandlerFactory = cacheHandlerFactory;
        this.passthroughHandlerFactory = passthroughHandlerFactory;
        this.mutatorHandlerFactory = mutatorHandlerFactory;
    }

    /**
     * Creates a cached object.
     * @param {*} cacheableObject the object being cached.
     */
    create(cacheableObject) {
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
                    cachedObject[method] = new Proxy(cacheableObject[method],
                        this.passthroughHandlerFactory.create());
                } else if (cachedObject.options.methods[method].mutator) {
                    // Handle mutator methods
                    cachedObject[method] = new Proxy(cacheableObject[method],
                        this.mutatorHandlerFactory.create(this.cacher));
                } else {
                    // Handle cached methods
                    cachedObject[method] = new Proxy(cacheableObject[method],
                        this.cacheHandlerFactory.create(this.cacher, this.hashFactory));
                }
            } else {
                // Handle cached methods
                cachedObject[method] = new Proxy(cacheableObject[method],
                    this.cacheHandlerFactory.create(this.cacher, this.hashFactory));
            }
        }
        return cachedObject;
    }

    /**
     * Returns a new cachified object.
     * @param {*} cacheableObject the object being cached.
     * @returns {*} returns the cached version of the cacheableObject.
     */
    cachify(cacheableObject) {
        return this.create(cacheableObject);
    }

    /**
     * Returns a set of strings that correspond to the names of the own member methods of the object.
     * @param {*} obj the object being analyzed.
     * @returns {Array<string>} a list of the methods.
     * @private
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
     * @private
     */
    [checkCacheableObject](obj) {
        if (Object.getPrototypeOf(obj.constructor).name !== 'Cacheable') {
            throw new Error('The "cacheableObject" argument must be of type Class');
        }
    }
}

module.exports = CachedObjectFactory;
