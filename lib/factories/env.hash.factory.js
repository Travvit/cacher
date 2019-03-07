const crypto = require('crypto');
const HashFactory = require('./hash.factory.js');

/* The application envionment. */
const NODE_ENV = process.env.NODE_ENV || 'development';

/* Private methods */
const stringifyParams = Symbol('stringifyParams');

/**
 * This is used to generate hash values.
 * @class
 * @param {*} app the name of the Application. Default value is extracted from environment variables.
 * @param {*} env the name of the Environment. Default value is extracted from environment variables.
 */
class EnvHashFactory extends HashFactory {
    constructor(app, env) {
        super();
        this.NODE_ENV = env || NODE_ENV;
    }

    /**
     * This method generates the Redis hash key.
     * @param {*} method the name of the method invoking the cache. Default value is extracted from environment variables.
     * @param  {...any} params the parameters passed on to the invoked method.
     * @returns {string} the hash key necessary for a cache key.
     */
    create(className, method, ...params) {
        if (!className) throw new Error('Class name is required for hashing');
        if (!method) throw new Error('Method name is required for hashing');
        let paramVals = this[stringifyParams](params);
        const key = `${this.NODE_ENV}.${className}.${method}.[${paramVals}]`;
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

module.exports = EnvHashFactory;
