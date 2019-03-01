const NS_PER_SEC = 1e9;
const MS_PER_SEC = 1e6;

class Timer {
    constructor() {
        this.globalStartTime = new Date();
    }

    /**
     * Method used to start the timer.
     */
    start() {
        // console.log(`Timer started at: ${new Date()}`);
        this.startTime = process.hrtime();
        this.lastRecTime = this.startTime;
        return this.startTime;
    }

    /**
     * Returns the HR interval elapsed since last interval.
     */
    intervalHR() {
        let now = process.hrtime();
        let diff = process.hrtime(this.lastRecTime);
        this.lastRecTime = now;
        return diff;
    }

    /**
     * Returns the milliseconds interval elapsed since last interval.
     */
    intervalMS() {
        let now = process.hrtime();
        let diff = process.hrtime(this.lastRecTime);
        this.lastRecTime = now;
        return ((diff[0] * NS_PER_SEC) + diff[1]) / MS_PER_SEC;
    }

    /**
     * Sleeps for the specified amount of time.
     * @param {number} ms the sleep time in milliseconds
     */
    sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(true);
            }, ms);
        });
    }
}

module.exports = new Timer();
