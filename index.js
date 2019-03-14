const cacheAssembler = require('./lib/cache.assembler.js');

const Cacheable = require('./lib/cacheable.js');

const getCachedObjectFactory = cacheAssembler.getCachedObjectFactory.bind(cacheAssembler);

module.exports = { Cacheable, getCachedObjectFactory };
