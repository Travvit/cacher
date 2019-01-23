const crypto = require('crypto');

/* Private methods */
const stringifyParams = Symbol('stringifyParams');

/**
 * This is used to generate hash values.
 * @class
 * @param {*} app the name of the Application. Default value is extracted from environment variables.
 * @param {*} env the name of the Environment. Default value is extracted from environment variables.
 */
class HashFactory {
    constructor(app, env) {
        this.app = process.env.APP_NAME || app;
        this.env = process.env.NODE_ENV || env;
    }

    /**
     * This method generates the Redis hash key.
     * @param {*} method the name of the method invoking the cache. Default value is extracted from environment variables.
     * @param  {...any} params the parameters passed on to the invoked method.
     * @returns {string} the hash key necessary for a cache key.
     */
    create(className, method, ...params) {
        if (className === null || className === undefined) throw new Error('Class name is required for hashing');
        if (method === null || method === undefined) throw new Error('Method name is required for hashing');
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

module.exports = HashFactory;
