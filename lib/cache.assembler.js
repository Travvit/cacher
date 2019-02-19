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

    /**
     * Returns a hash factory.
     * @param {string} name the name of the factory
     */
    getHashFactory(name) {
        let HashFactory;
        switch (name) {
            case 'AppEnv':
                HashFactory = require('./appenv.hash.factory.js');
                return new HashFactory();
            case 'Env':
                HashFactory = require('./env.hash.factory.js');
                return new HashFactory();
            default:
                HashFactory = require('./appenv.hash.factory.js');
                return new HashFactory();
        }
    }

    /**
     * This method returns a cache factory.
     * @param {*} options
     * @param {string} options.factory the name of the factory
     */
    getCacheFactory({ factory } = {}) {
        const CachedObject = require('./cachedObject.js');
        return new CachedObject(
            this.getCacher(),
            this.getHashFactory(factory),
            cacheHandlerFactory,
            passthroughHandlerFactory,
            mutatorHandlerFactory);
    }
}

module.exports = new CacheAssembler();
