# tz-cacher

1.0.0

This library enables caching an objects that implement the `Cacheable` interface. It does the hard work for you so you don't have to! 😎

# Table of Concepts

## Summary
It is very important to utilize a caching service or server to speedup the response of a Node.js application. A long running query or heavy IO operation can slow down an application. Often times developers use a client library for a backing server/service to cache responses of long running processes within their application. This creates a direct dependency of the caching code with the caching library and the underlying service.

There is also a concern with users being served stale/outdated/invalid information from the cache. What is required is a reliable caching mechanism that allows the developer to take advantage of a caching service without the concern of ever using invalid data.

## Features
1.  Simple caching interface.
2.  Backing service abstracted away.
3.  Customizable expiration of cached content.
4.  Simultaneous eviction of all invalid cached data.
5.  Prevent parts of an object from getting cached.

## Core concepts

## Getting Started

## Usage Examples
```javascript
const { Cacheable } = require('tz-cacher');

// Create a Cacheable type.
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
```

You can then used it as follows:
```javascript
const { CacheFactory } = require('tz-cacher');

const cacheableObject = new new TestClass();

const cachedObject = await CacheFactory.cachify();

// Call the methods of the cached object
cachedObject.ttlBucketsMethod('Tester');
```

You can also use the Injection pattern to return cachified instances of regular components:
```javascript
// The following returns a cachified DAL. NOTE: The DAL class has implemented the Cacheable interface.
getDAL() {
    const AccountsDAL = require('./account.dal.js');
    const DALHelper = require('../../shared/pgDAL/dal.helper.js');
    return CacheFactory.cachify(new AccountsDAL(DALHelper));
}
```

## API Reference

## Note

## Help and Feedback


