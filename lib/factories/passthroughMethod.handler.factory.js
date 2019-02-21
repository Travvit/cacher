const MethodHandlerFactory = require('./method.handler.factory.js');
const PassthroughMethodHandler = require('../methodHandlers/passthroughMethod.handler.js');

/**
 * An implementation of the HandlerFactory that created a PassthroughHandler.
 * @class
 */
class PassthroughMethodHandlerFactory extends MethodHandlerFactory {
    /**
     * Creates a passthrough method handler.
     * @returns a passthrough method handler.
     */
    create() {
        return new PassthroughMethodHandler();
    }
}

module.exports = new PassthroughMethodHandlerFactory();
