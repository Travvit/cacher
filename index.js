const CacheAssembler = require('./lib/cache.assembler.js');

const Cacheable = require('./lib/cacheable.js');

const CacheFactory = CacheAssembler.getCacheFactory();

module.exports = { Cacheable, CacheFactory };
