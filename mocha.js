require('tz-config');

process.env.NODE_ENV = 'development';
process.env.APP_NAME = 'tz-cacher-dev';

let _ = require('lodash');
let Mocha = require('mocha');
let fs = require('fs');
let util = require('tz-util');
let logger = require('tz-logger');


let args = process.argv;
logger.debug('mocha.js: args: ', args);
args.shift();
args.shift();
let dirs = ['./*.test.js', './**/*.test.js'];

// require('./server/sequelize.js');

logger.debug('mocha.js: dirs:', dirs);

// gather files from dirs
let rawFiles = util.getGlobbedFiles(dirs);
let files = [];
if(args.length) {
    files = args
    _.forEach((files), filePath => {
        if(!_.startsWith(filePath, '.')) filePath = `./${filePath}`;
        if(!_.includes(rawFiles, filePath))   {
            let failMessage = `${filePath} is not a valid test path name!!!`
            logger.debug(failMessage);
            console.log(failMessage);
            process.exit();
        }
    })
} else {
    _.forEach((rawFiles), file => {
        if(!_.includes(file, 'node_modules')) files.push(file);
    });
}
logger.debug('mocha.js: files:', files);
// add test files to mocha
let mochaTests = new Mocha({ timeout: 20000 });
_.forEach(files, (file) => {
    mochaTests.addFile(file);
});

// Run the tests
function mochaRun(m) {
    return new Promise((resolve, reject) => {
        let mochaInstance = m.run();

        // catch test end signals
        mochaInstance.on('test end', () => {
            logger.debug('test end signal received');
        });

        // exit on end signal
        mochaInstance.on('end', () => {
            logger.debug('end signal received');
            require.cache = {};
            resolve(true);
        });
    });
}

async function runTests() {
    await mochaRun(mochaTests);
    process.exit();
}

runTests();
