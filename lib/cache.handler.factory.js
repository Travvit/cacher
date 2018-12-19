const Handlerfactory = require('./handler.factory.js');
const CacheHandler = require('./cache.handler.js');

/**
 * An implementation of the HandlerFactory that created a CacheHandler.
 * @class
 */
class CacheHandlerFactory extends Handlerfactory {
    /**
     * Creates a cache handler.
     * @returns a cache handler.
     * @param {object} cacher the cacher used to cache the method responses.
     * @param {object} hashFactory the method that generates the key for the cached value.
     */
    create(cacher, hashFactory) {
        return new CacheHandler(cacher, hashFactory);
    }
}

module.exports = new CacheHandlerFactory();
