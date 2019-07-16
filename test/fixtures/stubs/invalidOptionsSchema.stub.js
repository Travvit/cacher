const Cacheable = require('../../../lib/cacheable.js');

/**
 * The caching options for this class will fail JSON Schema validation
 */
class InvalidOptionsSchema extends Cacheable {
    getOptions() {
        return {};
    }
}

module.exports = InvalidOptionsSchema;
