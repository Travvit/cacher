# tz-cacher

1.0.0

This library enables caching objects that implement the `Cacheable` interface. It does the hard work for you so you don't have to! 😎

# Table of Contents

## Summary
It is very important to utilize a caching service or server to speedup the response of a Node.js application. A long running query or heavy I/O operation can slow down an application. Often times developers use a client library for a backing server/service to cache responses of long running processes within their application. This creates a direct dependency of the caching code with the caching library and the underlying service.

There is also a concern with users being served stale/outdated or invalid data from the cache.

What is required is a reliable caching mechanism that allows the developer to take advantage of a caching service without the concern of ever using invalid data. `tz-cacher` addresses these issues along with several others as listed below.

## Features
1.  Customizible expiry time per cached object or per method of a cached object.
2.  Simple caching interface.
3.  Backing service abstracted away.
4.  Simultaneous eviction of all invalid cached data.
5.  Prevent parts of an object from getting cached.

## Core concepts
In order to cache an object, and make it consumable by other parts of the code, we would need to cache the results of the individual methods. Therefore we'd need to control the caching of the individual methods. Normally a class will have the following type of public methods:
-   Methods that fetch or produce data that may be cached
-   Methods that fetch or produce data that should not be cached, or passed through.
-   Methods that set or update data and are not cacheable.
  
`tz-cacher` allows you to handle the processing of all 3 types of methods. The library also allows the instantaneous invalidation of cached objects when a method updates the source of the underlying data. This is done my tracking the cached values within a specific group of the source, called a `bucket`. When the source of a bucket is updated, all data associated with that bucket is then considered invalid and are thus purged from the cache.

For example, when refering to a DAL object, the source of the data for the accessor methods of the DAL is the data table being accessed. By tying the DAL object to the table as a bucket, we can remove the stale data whenever we call an upsert method via the DAL.

Similar schemes may be applied to any `Cacheable` object.

## Installation
This is a Zayo specific library managed on our gemfury repo. `tz-cacher` can simply be installed with [npm](https://www.npmjs.com/):

```bash
npm install --save tz-cacher
```

## Usage Examples
The library exposes two components, the `Cacheable` interface, and a `CacheFactory`. Any `class` that instantiates cacheable objects, must extend the `Cacheable` interface and implement the `getOptions()` method. This method should return a caching options object as shown below.

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

const cacheableObject = new TestClass();

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

The library exposes the following:

### Cacheable

Abastract class that every cacheable object must inherit in order to be cached.

#### getOptions()

Returns **any** an object that defines caching options for individual methods.
Mutators, passthroughs and custom ttl methods and method responses stored
in special buckets are specified here. Default TTLs and buckets are also
specified here.

### CacheFactory.cachify()

Returns a new cachified object.

#### Parameters

-   `cacheableObject` **any** the object being cached.

Returns **[object]** returns the cached version of the cacheableObject.

## Note

Links within this documents to other documents within this repo, may not work locally. Please refer to the documents online within the [GitLab repository](https://gitlab.zayo.com/tranzact/tz-cacher).

## Help and Feedback

-   If you spot an error or a need for improvement and would like to fix it yourself, please submit a merge request.
-   Please submit a ticket if you would like to suggest an improvement to this doc.
