const CacheAssembler = require('./lib/cache.assembler.js');

const Cacheable = require('./lib/cacheable.js');

const cacheFactory = CacheAssembler.getCacheFactory();

module.exports = { Cacheable, cacheFactory };
