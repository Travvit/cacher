const Cacheable = require('../../../lib/cacheable.js');

/**
 * The caching options for this class will fail JSON Schema validation
 */
class MethodGlobalBucket extends Cacheable {
    getOptions() {
        return {
            ttl: 5,
            buckets: ['test'],
            methods: [
                {
                    name: 'methodOne',
                    type: 'passthrough'
                }, {
                    name: 'methodTwo',
                    type: 'cacheable',
                    buckets: ['GLOBAL']
                }
            ]
        };
    }
}

module.exports = MethodGlobalBucket;
