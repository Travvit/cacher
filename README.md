# tz-cacher

2.0.0

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
3.  Storage Manager abstracted away, but configurable via environment variables.
4.  Simultaneous eviction of all invalid cached data, when data source is updated.
5.  Prevent parts of an object from getting cached.
6.  Ability to utilize cached entities within a distribute environment.
7.  Runs a Garbage Collector for the Redis Storage Manager.

## Core concepts
In order to cache an object, and make it consumable by other parts of the code, we would need to cache the results of the individual methods within that object. Therefore we'd need to control the caching of the individual methods. Generally a class should have the following types of public methods:

-   Methods that fetch or produce data that may be cached. These methods are called cacheable.
-   Methods that fetch or produce data that should not be cached, or passed through. These methods are called passthrough.
-   Methods that set or update data and are not cacheable. These methods are called mutator.
  
`tz-cacher` allows you to handle the processing of all 3 types of methods. 

The library also allows the instantaneous invalidation of cached objects when a method updates the source of the underlying data. This is done my tracking the cached values within a specific group of the source, called a `bucket`. When the source of a bucket is updated, all data associated with that bucket is then considered invalid and are thus purged from the cache.

For example, when referring to a DAL object, the source of the data for the accessor methods of the DAL is the data table being accessed. By tying the DAL object to the table as a bucket, we can remove the stale data whenever we call an upsert method via the DAL.

Similar schemes may be applied to any `Cacheable` object.

Please note that a "cachified" object would still perform as expected, if the backing service goes offline. i.e. you can continue to service requests if the connection to the caching server is lost.

## Installation
This is a Zayo specific library managed on our gemfury repo. `tz-cacher` can simply be installed with [npm](https://www.npmjs.com/):

```bash
npm install tz-cacher
```

## Configuration
This library currently supports Redis as a Storage Manager. Other Storage Managers may be added in the future.

You are allowed to set the following configuration directives when using the cacher.

**NOTE** Config variables are associated with the application's config variables. 

```bash
# The application environment. default = "development"
NODE_ENV
# The name of the application, default = "tz-cacher"
APP_NAME
# Minimum TTL allowed for a cached entity. default = 5s
MIN_TTL
# Maximum TTL allowed for a cached entity. default = 24hrs
MAX_TTL
# Maximum length of the bucket name including the name of the app if any. default = 50
MAX_BUCKET_NAME_SIZE
# Maximum buckets allowed per cached item. default = 25
MAX_BUCKETS
# The flag that allows Redis caching to be turned off. default = false
REDIS_MANAGER_ON
# The URL for the Redis server, default = "redis://localhost:6379"
REDIS_URL
# The URL for the Redis server, offered by Redislab
REDISCLOUD_URL
# The maximum retry time in milliseconds after which retry attempts will fail. default = 30K
REDIS_MAX_RETRY_TIME
# The maximum retry times after which retry attempts will fail. default = 31
REDIS_MAX_RETRY_ATTEMPTS
# The frequency in milliseconds with which connection retry is attempted. default = 1000
REDIS_RETRY_FREQ
# Number of members deleted in bulk from a regular bucket. default = 2000
REG_BUCKET_MEMBER_BULK_DEL_SIZE
# Number of members deleted in bulk from the Global bucket. default = 2000
GLOBAL_BUCKET_MEMBER_BULK_DEL_SIZE
# Enables the garbage collector for RedisStorageManager. default = "false"
REDIS_GC_ON
# GC Master lease renew duration in milliseconds. default 30K
REDIS_GC_INTERVAL
# The percentage of CPU usage the is permissible for GC. default 50
CPU_LOAD_CUTOFF
# Number of members deleted in bulk from a regular bucket during GC. default = 2000
REG_BUCKET_MEMBER_BULK_GC_SIZE
# Number of members deleted in bulk from the Global bucket during GC. default = 1000
GLOBAL_BUCKET_MEMBER_BULK_GC_SIZE
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
            methods: [{
                name: 'passthroughMethod', // This is a passthrough method, it's values are not cached.
                type: 'passthrough'
            }, {
                name: 'ttlMethod',      // This method is cached and has a custom TTL.
                type: 'cacheable',
                ttl: 15
            }, {
                name: 'ttlBucketsMethod',   // This method is cached and has a custom TTL,
                                            // and a specific list of buckets it's associated with.
                type: 'cacheable',
                ttl: 15,
                buckets: ['test-bucket', 'test-bucket-2']
            }, {
                name: 'ttlBucketsMethodAll',    // This method is cached and has a custom TTL, and allows
                                                // the key to be saved in all buckets of current app.
                type: 'cacheable',
                ttl: 15,
                buckets: ['*']
            }, {
                name: 'ttlBucketsMethodOtherApp',   // This method is cached and has a custom TTL, and
                                                    // allows the key to be saved in buckets of other apps.
                type: 'cacheable',
                ttl: 15,
                buckets: ['app-1.bucket-1', 'app-2.*']
            }, {
                name: 'mutatorMethod',  // This method is a mutator. It's values are never cached, and
                                        // all buckets associated with it are cleared upon execution.
                type: 'mutator',
                buckets: ['test-bucket', 'test-bucket-2']
            }, {
                name: 'mutatorMethodAll',   // This method is a mutator. It's values are never cached, and all
                                            // buckets associated with the current app are cleared upon execution.
                type: 'mutator',
                buckets: ['*']
            }]
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
    ttlBucketsMethodAll(name) {
        return `TTL All Buckets: Hello ${name}!`;
    }
    ttlBucketsMethodOtherApp(name) {
        return `TTL Other App Buckets: Hello ${name}!`;
    }
    mutatorMethod(name) {
        return `Mutator: Hello ${name}!`;
    }
    mutatorMethodAll(name) {
        return `Mutator All: Hello ${name}!`;
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

const cachedObject = await CacheFactory.cachify(cacheableObject);

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

### CachedObjectFactory.cachify()

Returns a new cachified object.

#### Parameters

-   `cacheableObject` **any** the object being cached.

Returns **[object]** returns the cached version of the cacheableObject.

## Note

Links within this documents to other documents within this repo, may not work locally. Please refer to the documents online within the [GitLab repository](https://gitlab.zayo.com/tranzact/tz-cacher).

## Help and Feedback

-   If you spot an error or a need for improvement and would like to fix it yourself, please submit a merge request.
-   Please submit a ticket if you would like to suggest an improvement to this doc.
