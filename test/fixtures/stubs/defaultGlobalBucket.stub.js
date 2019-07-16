const Cacheable = require('../../../lib/cacheable.js');

/**
 * The caching options for this class will fail JSON Schema validation
 */
class DefaultGlobalBucket extends Cacheable {
    getOptions() {
        return {
            ttl: 5,
            buckets: ['test', 'GLOBAL'],
            methods: [
                {
                    name: 'methodOne',
                    type: 'passthrough'
                }, {
                    name: 'methodTwo',
                    type: 'passthrough'
                }
            ]
        };
    }
}

module.exports = DefaultGlobalBucket;
