/**
 * Abastract class that every cacheable object must inherit in order to be cached.
 * @class
 */
class Cacheable {
    /**
     * @returns an object that defines caching options for individual methods.
     * Mutators, passthroughs and custom ttl methods and method responses stored
     * in special buckets are specified here. Default TTLs and buckets are also
     * specified here.
     */
    getOptions() {}
}

module.exports = Cacheable;
