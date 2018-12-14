/**
 * Passthrough Handlers are proxy handlers for methods who's responses are not cached.
 */
class PassthroughHandler {
    async apply(target, thisArg, argumentsList) {
        // Ensure required arguments were passed
        if (target === undefined || target === null || thisArg === undefined || thisArg === null) {
            throw new Error('Arguments, target and thisArg are required.');
        }
        let result;
        if (argumentsList instanceof Array) {
            result = await target.call(thisArg.cachedObject, ...argumentsList);
        } else {
            result = await target.call(thisArg.cachedObject, argumentsList);
        }
        return result;
    }
}

module.exports = PassthroughHandler;
