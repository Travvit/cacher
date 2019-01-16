/**
 * Motator Handlers are proxy handlers for methods that mutate the source of truth of a cached object.
 * @class
 * @param {object} cacher
 */
class MutatorHandler {
    constructor(cacher) {
        this.cacher = cacher;
    }

    /**
     * This method abstracts the mutator method call.
     * @param {*} target the method that performs a data mutation.
     * @param {*} thisArg the object who's method is cached.
     * @param {*} argumentsList the list of arguments passed to the cached method.
     * @returns the result of the mutator method.
     */
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