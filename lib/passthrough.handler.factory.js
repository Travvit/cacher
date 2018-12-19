const Handlerfactory = require('./handler.factory.js');
const PassthroughHandler = require('./passthrough.handler.js');

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
        return new PassthroughHandler();
    }
}

module.exports = new PassthroughHandlerFactory();
