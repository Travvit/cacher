/**
 * Motator Handlers are proxy handlers for methods that mutate the source of truth of a cached object.
 * @param {object} cacher
 */
class MutatorHandler {
    constructor(cacher) {
        this.cacher = cacher;
    }
    async apply(target, thisArg, argumentsList) {
        // Ensure required arguments were passed
        if (target === undefined || target === null || thisArg === undefined || thisArg === null) {
            throw new Error('Arguments, target and thisArg are required.');
        }
        // Get the result from the method.
        let result;
        if (argumentsList instanceof Array) {
            result = await target.call(thisArg, ...argumentsList);
        } else {
            result = await target.call(thisArg, argumentsList);
        }
        // Invalidate the keys from the associated buckets
        this.cacher.purgeBuckets(thisArg.options.methods[target.name].buckets);
        // Return the result from the method.
        return result;
    }
}

module.exports = MutatorHandler;
