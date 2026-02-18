const { error } = require('console');
const { setTimeout } = require('timers/promises');
const { parentPort } = require('worker_threads');

parentPort.on('message', async (num) => {
    await setTimeout(500)
    let result = 0
    for(let idx = 1; idx < num; idx++) {
        result += idx;
    }
    parentPort.postMessage({ data: result });
});