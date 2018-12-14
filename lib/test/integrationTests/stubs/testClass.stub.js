const Cacheable = require('../../../cacheable.js');

class TestClass extends Cacheable {
    constructor() {
        super();
        this.options = this.getOptions();
        this.cachedObject = this;
    }
    getOptions() {
        return {
            ttl: 100,
            buckets: ['test-bucket'],
            methods: {
                passthroughMethod: {
                    passthrough: true
                },
                ttlMethod: {
                    ttl: 15
                },
                ttlBucketsMethod: {
                    ttl: 15,
                    buckets: ['test-bucket', 'test-bucket-2']
                },
                mutatorMethod: {
                    mutator: true,
                    buckets: ['test-bucket', 'test-bucket-2']
                }
            }
        };
    }
    passthroughMethod(name) {
        return `Passthrough: Hello ${name}!`;
    }
    ttlMethod(name) {
        return `TTL: Hello ${name}!`;
    }
    ttlBucketsMethod(name) {
        return `TTL Buckets: Hello ${name}!`;
    }
    mutatorMethod(name) {
        return `Mutator: Hello ${name}!`;
    }
    unconfiguredMethod(name) {
        return `Unconfigured: Hello ${name}!`;
    }
}

module.exports = new TestClass();
