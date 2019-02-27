const GarbageCollectionStrategy = require('./garbageCollectionStrategy.js');
const _ = require('lodash');

/**
 * This is the largest bucket first garbage collection strategy.
 * @param {any[]} buckets a list of buckets.
 */
class LBFGarbageCollectionStrategy extends GarbageCollectionStrategy {
    constructor(buckets) {
        super();
        this.buckets = buckets;
    }

    sort() {}

    execute() {}
}

module.exports = new LBFGarbageCollectionStrategy();
