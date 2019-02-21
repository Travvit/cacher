const MethodHandlerFactory = require('./method.handler.factory.js');
const CachedMethodHandler = require('../methodHandlers/cachedMethod.handler.js');

/**
 * An implementation of the HandlerFactory that created a CachedMethodHandler.
 * @class
 */
class CachedMethodHandlerFactory extends MethodHandlerFactory {
    /**
     * Creates a cached method handler.
     * @returns a cache handler.
     * @param {object} cacher the cacher used to cache the method responses.
     * @param {object} hashFactory the method that generates the key for the cached value.
     */
    create(cacher, hashFactory) {
        return new CachedMethodHandler(cacher, hashFactory);
    }
}

module.exports = new CachedMethodHandlerFactory();
