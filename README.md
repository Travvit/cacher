# tz-cacher

1.5.0

This library enables caching objects that implement the `Cacheable` interface. It does the hard work for you so you don't have to! 😎

# Table of Contents

## Summary
It is very important to utilize a caching service or server to speedup the response of a Node.js application. A long running query or heavy I/O operation can slow down an application. Often times developers use a client library for a backing server/service to cache responses of long running processes within their application. However, this creates a direct dependency of the caching code with the caching library and the underlying service.

There are also concerns with users being served stale/outdated or invalid data from the cache. An example of this would be user permission related objects, that have been cached. If any of the underlying data for user permission is updated, a significant number of the cached data would need to be evicted from the cache as soon as the update is applied.

What is required is a reliable caching mechanism that allows the developer to take advantage of a caching service without the concern of ever using invalid data.

`tz-cacher` addresses these issues along with several others as listed below.

## Features
1.  Customizable expiry time per cached object, or per method, of a cached object.
2.  Simple caching API.
3.  Backing service abstracted away, but configurable via environment variables.
4.  Simultaneous eviction of all invalid cached data, when data source is updated.
5.  Prevent parts of an object from getting cached.

## Core concepts
In order to cache an object, and make it consumable by other parts of the code, we would need to cache the results of the individual methods within that object. Therefore we'd need to control the caching of the individual methods. Generally a class should have the following types of public methods:

-   Methods that fetch or produce data that may be cached. These methods are called cacheable.
-   Methods that fetch or produce data that should not be cached, or passed through. These methods are called passthrough.
-   Methods that set or update data and are not cacheable. These methods are called mutator.
  
`tz-cacher` allows you to handle the processing of all 3 types of methods. 

The library also allows the instantaneous invalidation of cached objects when a method updates the source of the underlying data. This is done my tracking the cached values within a specific group of the source, called a `bucket`. When the source of a bucket is updated, all data associated with that bucket is then considered invalid and are thus purged from the cache.

For example, when refering to a DAL object, the source of the data for the accessor methods of the DAL is the data table being accessed. By tying the DAL object to the table as a bucket, we can remove the stale data whenever we call an upsert method via the DAL.

Similar schemes may be applied to any `Cacheable` object.

Please note that a "cachified" object would still perform as expected, if the backing service goes offline. i.e. you can continue to service requests if the connection to the caching server is lost.

## Installation
This is a Zayo specific library managed on our gemfury repo. `tz-cacher` can simply be installed with [npm](https://www.npmjs.com/):

```bash
npm install --save tz-cacher
```

## Configuration
This library currently supports Redis as a backing service. Other backing services may be added in the future.

You are allowed to set the following configuration directives when using the cacher.

**NOTE** Config variables are associated with the application's config variables. 

```bash
# The name of the application, default = "tz-cacher-dev"
APP_NAME = "tz-cacher-dev"
# The maximum retry time in milliseconds after which retry attempts will fail., default = 30000
MAX_RETRY_TIME = 30000
# The maximum retry times after which retry attempts will fail. default = 31
MAX_RETRY_ATTEMPTS = 31
# The frequency in milliseconds with which connection retry is attempted. default = 1000
REDIS_RETRY_FREQ = 1000
# The flag that allows Redis caching to be turned off. default = false
REDIS_MANAGER_ON = "false"
# The URL for the Redis server, default = "redis://localhost:6379"
REDIS_URL = ""
# The URL for the Redis server, offered by Redislab
REDISCLOUD_URL
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
            ttl: 100,                   // Default TTL for the class objects
            buckets: ['test-bucket'],   // Default buckets for the class objects
            methods: {
                passthroughMethod: {
                    passthrough: true   // This is a passthrough method, it's values are not cached.
                },
                ttlMethod: {
                    ttl: 15             // This method is cached and has a custom TTL.
                },
                ttlBucketsMethod: {
                    ttl: 15,            // This method is cached and has a custom TTL, and a specific list of buckets it's associated with.
                    buckets: ['test-bucket', 'test-bucket-2']
                },
                mutatorMethod: {
                    mutator: true,      // This method is a mutator. It's values are never cached, and all buckets associated with it are cleared upon execution.
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

You can also use the Assembly pattern to return cachified instances of regular components:
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
