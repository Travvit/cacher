const passthroughHandlerFactory = require('./passthrough.handler.factory.js');
const cacheHandlerFactory = require('./cache.handler.factory.js');
const mutatorHandlerFactory = require('./mutator.handler.factory.js');

class CacheAssembler {
    getCacheManager() {
        const RedisManager = require('./redisManager.js');
        return RedisManager;
    }

    getCacher() {
        const Cacher = require('./cacher.js');
        return new Cacher(this.getCacheManager());
    }

    getHashFactory() {
        const HashFactory = require('./hash.factory.js');
        return new HashFactory();
    }

    getCacheFactory() {
        const CachedObject = require('./cachedObject.js');
        return new CachedObject(
            this.getCacher(),
            this.getHashFactory(),
            cacheHandlerFactory,
            passthroughHandlerFactory,
            mutatorHandlerFactory);
        // return new CachedObject(
        //     new CacheHandler(this.getCacher(), this.getHashFactory()),
        //     new PassthroughHandler(),
        //     new MutatorHandler(this.getCacher()));
    }
}

module.exports = new CacheAssembler();
