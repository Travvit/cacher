/* eslint-disable quote-props */
const Cacheable = require('../../cacheable.js');

class TestClass extends Cacheable {
    constructor() {
        super();
        this.options = this.getOptions();
        this.cachedObject = this;
    }
    getOptions() {
        return {
            ttl: 20,
            buckets: ['test-bucket'],
            methods: [{
                name: 'testMethod',
                type: 'cacheable',
                buckets: ['test-bucket']
            }, {
                name: 'testMethodObj',
                type: 'cacheable',
                buckets: ['test-bucket']
            }, {
                name: 'testMethodArray',
                type: 'cacheable',
                buckets: ['test-bucket']
            }, {
                name: 'passthroughMethod',
                type: 'passthrough'
            }, {
                name: 'ttlMethod',
                type: 'cacheable',
                ttl: 15
            }, {
                name: 'ttlBucketsMethod',
                type: 'cacheable',
                ttl: 15,
                buckets: ['test-bucket', 'test-bucket-2', 'tz-cacher-dev.test-bucket-3']
            }, {
                name: 'mutatorMethod',
                type: 'mutator',
                buckets: ['test-bucket', '*', 'test-bucket-2', 'tz-cacher-dev.test-bucket-3', 'tz-permission.bucket-1', 'tz-permission.bucket-3', 'tz-permission.*']
            }, {
                name: 'bucketMethod1',
                type: 'cacheable',
                buckets: ['bucket-1']
            }, {
                name: 'bucketMethod2',
                type: 'cacheable',
                buckets: ['bucket-1', 'bucket-2']
            }, {
                name: 'bucketMethod3',
                type: 'cacheable',
                buckets: ['bucket-1', 'bucket-2', 'bucket-3']
            }, {
                name: 'bucketMethod4',
                type: 'cacheable',
                buckets: ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4']
            }, {
                name: 'bucketMethod5',
                type: 'cacheable',
                buckets: ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4', 'bucket-5']
            }, {
                name: 'bucketMethodMutator1',
                type: 'mutator',
                buckets: ['bucket-1']
            }, {
                name: 'bucketMethodMutator2',
                type: 'mutator',
                buckets: ['bucket-1', 'bucket-2']
            }, {
                name: 'bucketMethodMutator3',
                type: 'mutator',
                buckets: ['bucket-1', 'bucket-2', 'bucket-3']
            }, {
                name: 'bucketMethodMutator4',
                type: 'mutator',
                buckets: ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4']
            }, {
                name: 'bucketMethodMutator5',
                type: 'mutator',
                buckets: ['bucket-1', 'bucket-2', 'bucket-3', 'bucket-4', 'bucket-5']
            }]
        };
    }
    testMethod(name) {
        return `Hello ${name}!`;
    }
    testMethodObj(obj) {
        return obj;
    }
    testMethodArray(...obj) {
        return obj;
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
