const Handlerfactory = require('./handler.factory.js');

/**
 * An implementation of the HandlerFactory that created a PassthroughHandler.
 * @class
 */
class PassthroughHandlerFactory extends Handlerfactory {
    /**
     * Creates a passthrough handler.
     * @returns a passthrough handler.
     */
    create() {
        let passthroughHandler = {};

        /**
         * This method abstracts the passthrough method call.
         * @param {*} target the method who's value is not cached.
         * @param {*} thisArg the object who's methods are cached.
         * @param {*} argumentsList the list of arguments passed to the passthrough method.
         * @returns the result of the passthrough method.
         */
        passthroughHandler.apply = async (target, thisArg, argumentsList) => {
            // Ensure required arguments were passed
            if (target === undefined || target === null || thisArg === undefined || thisArg === null) {
                throw new Error('Arguments, target and thisArg are required.');
            }
            let result;
            if (argumentsList instanceof Array) {
                result = await target.call(thisArg, ...argumentsList);
            } else {
                result = await target.call(thisArg, argumentsList);
            }
            return result;
        };
        return passthroughHandler;
    }
}

module.exports = new PassthroughHandlerFactory();
