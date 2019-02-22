const logger = require('tz-logger');
const GarbageCollector = require('./garbageCollector.js');

function sleep(ms) {
    // console.log(`Waiting for ${ms} ms...`);
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * This module should be run as a forked process by a RedisStorageManager.
 */
class RedisGarbageCollector extends GarbageCollector {
    /**
     * Runs the garbage collection process.
     */
    async run() {
        logger.log('Running GC...');
        logger.log('Oh no!!!!');
        // await sleep(10000);
    }
}

// Run the garbage collector.
new RedisGarbageCollector().run();

/**
 * Perform cleanup here because the process is about to terminate.
 */
process.on('SIGTERM', () => {
    logger.log('GC timed out!');
});
