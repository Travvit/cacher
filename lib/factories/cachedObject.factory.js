
const Factory = require('./factory.js');
const _ = require('lodash');
const Ajv = require('ajv');

/* Private methods */
const getAllMethodNames = Symbol('getAllMethodNames');
const checkCacheableObject = Symbol('checkCacheableObject');
const validCacheOptions = Symbol('validCacheOptions');
const validate = Symbol('validate');

/* Defaults */
const DEFAULTS = {
    ttl: 180, // The default global TTL for the object
    buckets: [], // A list of default buckets for the current object.
    methods: [], // A list of methods and how they need to be cached.
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
 * @param {string} defSchema the definitions for the cache options schema.
 * @param {string} objSchema the validation schema for the cache options.
 */
class CachedObjectFactory extends Factory {
    constructor({
        cacher,
        hashFactory,
        cacheHandlerFactory,
        passthroughHandlerFactory,
        mutatorHandlerFactory,
        defSchema,
        objSchema
    }) {
        super();
        this.cacher = cacher;
        this.hashFactory = hashFactory;
        this.cacheHandlerFactory = cacheHandlerFactory;
        this.passthroughHandlerFactory = passthroughHandlerFactory;
        this.mutatorHandlerFactory = mutatorHandlerFactory;
        // this.defSchema = defSchema;
        // this.objSchema = objSchema;
        this[validate] = new Ajv()
            .addSchema(JSON.parse(defSchema))
            .compile(JSON.parse(objSchema));
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
            // Locate the method within the options
            const foundMethod = _.find(cachedObject.options.methods, { name: method });
            if (foundMethod) {
                switch (foundMethod.type) {
                    case 'passthrough':
                        // Handle passthrough methods
                        cachedObject[method] = new Proxy(cacheableObject[method],
                            this.passthroughHandlerFactory.create());
                        break;
                    case 'mutator':
                        // Handle mutator methods
                        cachedObject[method] = new Proxy(cacheableObject[method],
                            this.mutatorHandlerFactory.create(this.cacher));
                        break;
                    case 'cacheable':
                    default:
                        // Handle cached methods
                        cachedObject[method] = new Proxy(cacheableObject[method],
                            this.cacheHandlerFactory.create(this.cacher, this.hashFactory));
                        break;
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
        _.forEach(keys, (method) => {
            if (method !== 'constructor' && method !== 'getOptions') methods.push(method);
        });
        return methods;
    }

    /**
     * This method ensures that the object being used is a cacheable object with valid options.
     * @param {*} cacheableObject the object being tested.
     * @throws Will throw and `Error` if obj is anything other than an object.
     * @private
     */
    [checkCacheableObject](cacheableObject) {
        if (Object.getPrototypeOf(cacheableObject.constructor).name !== 'Cacheable') {
            throw new Error('The "cacheableObject" argument must be of type Cacheable');
        }
        try {
            this[validCacheOptions](cacheableObject.getOptions());
        } catch (error) {
            throw new Error(`The caching options for ${cacheableObject.constructor.name} is incorrect! Reason: ${error.message}`);
        }
    }

    /**
     * Validates the values and format of the options for a cacheable object.
     * @param {*} options the options for a cacheable object.
     */
    [validCacheOptions](options) {
        // Validate JSON
        const schemaValid = this[validate](options);
        if (!schemaValid) throw new Error('Cache options schema validation error!');
        // Check for duplicate method names
        const dupMethodCounts = [];
        for (let i = 0; i < options.methods.length; i += 1) {
            if (dupMethodCounts[options.methods[i].name] === undefined) {
                // No duplicate found yet
                dupMethodCounts[options.methods[i].name] = 1;
            } else {
                throw new Error('Cache options cannot contain duplicate method names!');
            }
        }
        // Check for reserved bucket names
        const defaultBucketsValid = _.indexOf(options.buckets, 'GLOBAL') < 0;
        if (!defaultBucketsValid) throw new Error("Cache options cannot have 'GLOBAL' as default bucket name!");

        let methodBucketsValid = true;
        for (let method of options.methods) {
            methodBucketsValid = _.indexOf(method.buckets, 'GLOBAL') < 0;
            if (!methodBucketsValid) throw new Error("Cache options cannot have 'GLOBAL' as method bucket name!");
        }
        return true;
    }
}

module.exports = CachedObjectFactory;
