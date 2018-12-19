/**
 * Abastract class that every HandlerFactories object must inherit in order to create handler factories.
 * @class
 */
class HandlerFactory {
    /**
     * @returns an object that represents a handler factory.
     */
    create() {}
}

module.exports = HandlerFactory;
