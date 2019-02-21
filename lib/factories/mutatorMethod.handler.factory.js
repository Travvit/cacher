const MethodHandlerFactory = require('./method.handler.factory.js');
const MutatorMethodHandler = require('..//methodHandlers/mutatorMethod.handler.js');

/**
 * An implementation of the HandlerFactory that created a MutatorHandler.
 * @class
 */
class MutatorMethodHandlerFactory extends MethodHandlerFactory {
    /**
     * Creates a mutator handler.
     * @returns a mutator handler.
     * @param {object} cacher the cacher used to cache the method responses.
     */
    create(cacher) {
        return new MutatorMethodHandler(cacher);
    }
}

module.exports = new MutatorMethodHandlerFactory();
