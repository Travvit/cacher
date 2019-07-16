const Cacheable = require('../../../lib/cacheable.js');

/**
 * The caching options for this class will fail JSON Schema validation
 */
class DuplicateMethods extends Cacheable {
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
                    type: 'passthrough'
                }, {
                    name: 'methodOne',
                    type: 'passthrough'
                }
            ]
        };
    }
}

module.exports = DuplicateMethods;
