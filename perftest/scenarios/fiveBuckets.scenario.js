let {
    timer,
    redisRWClient,
    sendCommandAsync,
    logger,
    cachedObject,
    timeToLoad,
    getLoadStats,
    dbsizeAsync,
    memUsed,
    getMemUsage,
    infoAsync,
    timeToRead,
    getReadStats,
    timeToPurge,
    getPurgeStats,
    stats,
    cacheFactory,
    CacheAssembler,
    cacheableObject,
    sleep
} = require('./common.js');

async function initTests() {
    cacheFactory = CacheAssembler.getCacheFactory();
    cachedObject = await cacheFactory.cachify(cacheableObject);
    // Adding 5 seconds delay
    return sleep(2000);
}

/**
 * This is a single test scenario. It takes an options object that contains the input payload and
 * dependencies necessary to run this test.
 */
module.exports = async function scenario({
    numObjects
}) {
    return new Promise(async (resolve, reject) => {
        await initTests();

        if (redisRWClient.connected) {
            const numBuckets = 5;

            await sendCommandAsync('FLUSHALL');
            timer.start();
            logger.log(`bucketMethod${numBuckets}: Loading ${numObjects} objects...`);
            timer.interval();
            // Load only one bucket
            for (let i = 0; i < numObjects; i += 1) {
                cachedObject[`bucketMethod${numBuckets}`](i);
            }
            // Wait for - Load Time
            timeToLoad = await getLoadStats(dbsizeAsync, numObjects + numBuckets + 1);
            memUsed = getMemUsage(await infoAsync('memory'));
            logger.log(`Data loaded. Time taken: ${timeToLoad} ms`);
            logger.log(`Memory used: ${memUsed}`);
            timer.interval();
            logger.log('-------------------------');
            logger.log(`bucketMethod${numBuckets}: Fetching ${numObjects} objects...`);
            timer.interval();
            let fetchedData = [];
            for (let i = 0; i < numObjects; i += 1) {
                fetchedData.push(cachedObject[`bucketMethod${numBuckets}`](i));
            }
            // Wait for - Read Time
            timeToRead = await getReadStats(fetchedData, numObjects);
            logger.log(`Data read. Time taken: ${timeToRead} ms`);
            logger.log('-------------------------');
            logger.log('Purging data...');
            // await sleep(10000);
            cachedObject[`bucketMethodMutator${numBuckets}`]();
            // Wait for - Read Time
            timeToPurge = await getPurgeStats();
            logger.log(`Data purged. Time taken: ${timeToPurge} ms`);
            stats = {
                numObjects,
                numBuckets,
                timeToLoad,
                timeToRead,
                timeToPurge,
                memUsed
            };
            resolve(stats);
        }
    });
};

