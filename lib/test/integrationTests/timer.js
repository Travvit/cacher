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
        console.log(`Timer started at: ${new Date()}`);
        this.startTime = process.hrtime();
        this.lastRecTime = this.startTime;
    }

    /**
     * Displays the interval elapsed since last interval.
     */
    interval() {
        let now = process.hrtime();
        let diff = process.hrtime(this.lastRecTime);
        console.log(`Interval time: ${((diff[0] * NS_PER_SEC) + diff[1]) / MS_PER_SEC} ms`);
        this.lastRecTime = now;
    }
}

module.exports = new Timer();
