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
    timeToCollect,
    stats,
    cacheFactory,
    CacheAssembler,
    cacheableObject,
    getGCStats,
    sleep,
    APP_NAME,
    APP_ENV
} = require('../common.js');

let cachedObjectFactory;
// let hashFactory;

async function initTests() {
    // cacheFactory = CacheAssembler.getCacheFactory();
    // cachedObject = await cacheFactory.cachify(cacheableObject);

    cachedObjectFactory = CacheAssembler.getCachedObjectFactory({ app: 'tz-cacher-dev', env: APP_ENV, hashFactoryName: 'AppEnv', storageName: 'Redis' });
    // hashFactory = CacheAssembler.getHashFactory('AppEnv');
    cachedObject = await cachedObjectFactory.cachify(cacheableObject);
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
            const numBuckets = 2;

            await sendCommandAsync('FLUSHALL');
            timer.start();
            logger.log(`bucketMethod${numBuckets}: Loading ${numObjects} objects...`);
            timer.intervalMS();
            // Load only one bucket
            for (let i = 0; i < numObjects; i += 1) {
                cachedObject[`bucketMethod${numBuckets}`](i);
            }
            // Wait for - Load Time
            timeToLoad = await getLoadStats(dbsizeAsync, numObjects + numBuckets + 1);
            memUsed = getMemUsage(await infoAsync('memory'));
            logger.log(`Data loaded. Time taken: ${timeToLoad} ms`);
            logger.log(`Memory used: ${memUsed}`);
            timer.intervalMS();
            logger.log('-------------------------');
            logger.log(`bucketMethod${numBuckets}: Fetching ${numObjects} objects...`);
            timer.intervalMS();
            let fetchedData = [];
            for (let i = 0; i < numObjects; i += 1) {
                fetchedData.push(cachedObject[`bucketMethod${numBuckets}`](i));
            }
            // Wait for - Read Time
            timeToRead = await getReadStats(fetchedData, numObjects);
            logger.log(`Data read. Time taken: ${timeToRead} ms`);
            logger.log('-------------------------');
            logger.log('Waiting for data to expire...');
            // await sleep(25 * 1000);
            // cachedObject[`bucketMethodMutator${numBuckets}`]();
            // Wait for - Read Time
            timeToCollect = await getGCStats() - (cachedObject.options.ttl * 1000);
            logger.log(`Garbage collected. Time taken: ${timeToCollect} ms`);
            stats = {
                'Number of Objects': numObjects,
                'Number of Buckets': numBuckets,
                'Time to Load': timeToLoad,
                'Time to Read': timeToRead,
                'Time to GC': timeToCollect,
                'Memory Used': memUsed
            };
            resolve(stats);
        }
    });
};
