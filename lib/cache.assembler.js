/* eslint-disable global-require */
const passthroughMethodHandlerFactory = require('./factories/passthroughMethod.handler.factory.js');
const cachedMethodHandlerFactory = require('./factories/cachedMethod.handler.factory.js');
const mutatorMethodHandlerFactory = require('./factories/mutatorMethod.handler.factory.js');
const optionsDefSchema = require('./schemas/v2/configOptions.defs.js');
const optionsSchema = require('./schemas/v2/configOptions.schema.js');
const RedisStorageManager = require('./storageManagers/redisStorageManager.js');

/* Constants and flags */
/* The application instance name . */
const INSTANCE = process.env.DYNO || 'WEB.DEFAULT'; // TODO: This should be captured from tz-config

class CacheAssembler {
    /**
     * Returns a storage manager. Currently RedisStorageManager is the only available manager.
     * Additional StorageManagers may be provided in the future.
     * @param {*} options
     * @param {string} options.type the type of storage manager.
     * @param {string} options.app the name of the app.
     * @param {string} options.env the name of the environment.
     * @param {string} options.instance the name of the instance.
     */
    getStorageManager({
        type, app, env, instance
    }) {
        switch (type) {
            case 'Redis':
                if (this.redisStorageManager) {
                    return this.redisStorageManager;
                }
                this.redisStorageManager = new RedisStorageManager({ app, env, instance });
                return this.redisStorageManager;
            default:
                if (this.redisStorageManager) {
                    return this.redisStorageManager;
                }
                this.redisStorageManager = new RedisStorageManager({ app, env, instance });
                return this.redisStorageManager;
        }
    }

    /**
     * Returns an instance of a cacher.
     * @param {string} app the name of the app.
     * @param {string} env the name of the environment the app is running in.
     * @param {string} storageName the name of the cache storage.
     */
    getCacher(app, env, storageName) {
        const Cacher = require('./cacher.js');
        return new Cacher(app, env, this.getStorageManager({
            type: storageName, app, env, instance: INSTANCE
        }));
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
    getCachedObjectFactory({
        app, env, hashFactoryName, storageName
    } = {}) {
        const CachedObjectFactory = require('./factories/cachedObject.factory.js');
        return new CachedObjectFactory({
            cacher: this.getCacher(app, env, storageName),
            hashFactory: this.getHashFactory(hashFactoryName),
            cacheHandlerFactory: cachedMethodHandlerFactory,
            passthroughHandlerFactory: passthroughMethodHandlerFactory,
            mutatorHandlerFactory: mutatorMethodHandlerFactory,
            defSchema: optionsDefSchema,
            objSchema: optionsSchema
        });
    }
}

module.exports = new CacheAssembler();
