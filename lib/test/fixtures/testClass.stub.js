const Cacheable = require('../../cacheable.js');

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
                },
                bucketMethod1: {
                    buckets: ['bucket-1']
                },
                bucketMethod2: {
                    buckets: ['bucket-1', 'bucket-2']
                },
                bucketMethod3: {
                    buckets: ['bucket-1', 'bucket-2', 'bucket-3']
                },
                bucketMethod4: {
                    buckets: ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4']
                },
                bucketMethod5: {
                    buckets: ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4', 'bucket-5']
                },
                bucketMethodMutator1: {
                    mutator: true,
                    buckets: ['bucket-1']
                },
                bucketMethodMutator2: {
                    mutator: true,
                    buckets: ['bucket-1', 'bucket-2']
                },
                bucketMethodMutator3: {
                    mutator: true,
                    buckets: ['bucket-1', 'bucket-2', 'bucket-3']
                },
                bucketMethodMutator4: {
                    mutator: true,
                    buckets: ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4']
                },
                bucketMethodMutator5: {
                    mutator: true,
                    buckets: ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4', 'bucket-5']
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
    bucketMethod1(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethod2(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethod3(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethod4(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethod5(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethodMutator1(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethodMutator2(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethodMutator3(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethodMutator4(name) {
        return 'Bucket: Hello World!';
    }
    bucketMethodMutator5(name) {
        return 'Bucket: Hello World!';
    }
}

module.exports = new TestClass();
