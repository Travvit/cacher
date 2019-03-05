const crypto = require('crypto');
const HashFactory = require('./hash.factory.js');

/* Constants and flags */
const APP_NAME = process.env.APP_NAME || 'tz-cacher';
/* The application envionment. */
const APP_ENV = process.env.NODE_ENV || 'development';

/* Private methods */
const stringifyParams = Symbol('stringifyParams');

/**
 * This is used to generate hash values.
 * @class
 * @param {string} app the name of the Application. Default value is extracted from environment variables.
 * @param {string} env the name of the Environment. Default value is extracted from environment variables.
 */
class AppEnvHashFactory extends HashFactory {
    constructor(app, env) {
        super();
        this.APP_NAME = app || APP_NAME;
        this.APP_ENV = env || APP_ENV;
    }

    /**
     * This method generates the Redis hash key.
     * @param {string} className the name of the class.
     * @param {string} method the name of the method invoking the cache. Default value is extracted from environment variables.
     * @param  {...any} params the parameters passed on to the invoked method.
     * @returns {string} the hash key necessary for a cache key.
     */
    create(className, method, ...params) {
        if (!className) throw new Error('Class name is required for hashing');
        if (!method) throw new Error('Method name is required for hashing');
        let paramVals = this[stringifyParams](params);
        const key = `${this.app}.${this.env}.${className}.${method}.[${paramVals}]`;
        const hash = crypto.createHash('sha1').update(key).digest('hex');
        return hash;
    }

    /**
     * Stringifies the parameter based on JSON.
     * @param {*} params
     * @returns {string} the stringified parameter.
     * @private
     */
    [stringifyParams](params) {
        let stringifiedParams = [];
        for (let i = 0; i < params.length; i += 1) {
            if (typeof params[i] === 'string') {
                stringifiedParams.push(params[i]);
            } else {
                stringifiedParams.push(JSON.stringify(params[i]));
            }
        }
        return stringifiedParams;
    }
}

module.exports = AppEnvHashFactory;
