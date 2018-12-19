const Handlerfactory = require('./handler.factory.js');
const MutatorHandler = require('./mutator.handler.js');

/**
 * An implementation of the HandlerFactory that created a MutatorHandler.
 * @class
 */
class MutatorHandlerFactory extends Handlerfactory {
    /**
     * Creates a mutator handler.
     * @returns a mutator handler.
     * @param {object} cacher the cacher used to cache the method responses.
     */
    create(cacher) {
        return new MutatorHandler(cacher);
    }
}

module.exports = new MutatorHandlerFactory();
