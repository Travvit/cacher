const Factory = require('./factory.js');

/**
 * Abastract class that every MethodHandlerFactories object must inherit in order to create method handler factories.
 * @class
 */
class MethodHandlerFactory extends Factory {}

module.exports = MethodHandlerFactory;
