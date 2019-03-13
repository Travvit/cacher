const CacheAssembler = require('./lib/cache.assembler.js');

const Cacheable = require('./lib/cacheable.js');

const getCachedObjectFactory = CacheAssembler.getCachedObjectFactory;

module.exports = { Cacheable, getCachedObjectFactory };
