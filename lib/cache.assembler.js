/* eslint-disable global-require */
const passthroughMethodHandlerFactory = require('./factories/passthroughMethod.handler.factory.js');
const cachedMethodHandlerFactory = require('./factories/cachedMethod.handler.factory.js');
const mutatorMethodHandlerFactory = require('./factories/mutatorMethod.handler.factory.js');
const optionsDefSchema = require('./schemas/v2/configOptions.defs.js');
const optionsSchema = require('./schemas/v2/configOptions.schema.js');

class CacheAssembler {
    /**
     * Returns a storage manager. Currently RedisStorageManager is the only available manager.
     * Additional StorageManagers may be provided in the future.
     * @param {string} name the name of the cache storage.
     */
    getStorageManager(name) {
        let StorageManager;
        switch (name) {
            case 'Redis':
                StorageManager = require('./storageManagers/redisStorageManager.js');
                break;
            default:
                StorageManager = require('./storageManagers/redisStorageManager.js');
        }
        return StorageManager;
    }

    /**
     * Returns an instance of a cacher.
     * @param {string} app the name of the app.
     * @param {string} env the name of the environment the app is running in.
     * @param {string} storageName the name of the cache storage.
     */
    getCacher(app, env, storageName) {
        const Cacher = require('./cacher.js');
        return new Cacher(app, env, this.getStorageManager(storageName));
    }

    /**
     * Returns a hash factory.
     * @param {string} name the name of the hash factory
     */
    getHashFactory(name) {
        let HashFactory;
        switch (name) {
            case 'AppEnv':
                HashFactory = require('./factories/appenv.hash.factory.js');
                return new HashFactory();
            case 'Env':
                HashFactory = require('./factories/env.hash.factory.js');
                return new HashFactory();
            default:
                HashFactory = require('./factories/appenv.hash.factory.js');
                return new HashFactory();
        }
    }

    /**
     * This method returns a cache factory.
     * @param {*} options
     * @param {string} options.app the name of the app.
     * @param {string} options.env the name of the environment.
     * @param {string} options.hashFactoryName the name of the hash factory.
     * @param {string} options.storageName the name of the storage manager.
     */
    getCachedObjectFactory({ app, env, hashFactoryName, storageName } = {}) {
        const CachedObjectFactory = require('./factories/cachedObject.factory.js');
        return new CachedObjectFactory({
            cacher: this.getCacher(app, env, storageName),
            hashFactory: this.getHashFactory(hashFactoryName),
            cacheHandlerFactory: cachedMethodHandlerFactory,
            passthroughHandlerFactory: passthroughMethodHandlerFactory,
            mutatorHandlerFactory: mutatorMethodHandlerFactory,
            defSchema: optionsDefSchema,
            objSchema: optionsSchema });
    }
}

module.exports = new CacheAssembler();
