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
        const CacheHandler = require('./cache.handler.js');
        const PassthroughHandler = require('./passthrough.handler.js');
        const MutatorHandler = require('./mutator.handler.js');
        return new CachedObject(
            new CacheHandler(this.getCacher(), this.getHashFactory()),
            new PassthroughHandler(),
            new MutatorHandler(this.getCacher()));
    }
}

module.exports = new CacheAssembler();
