const ThreadPool = require('./utils/ThreadPool');
const CompressAudio = require('./utils/CompressAudio');
const path = require('path');

const test_pool = async () => {
    const pool = new ThreadPool({
        filename: path.join(__dirname, './utils/workers/worker.js'),
        size: 1
    });
    
    let promises = []
    for(let idx = 0; idx < 10; idx++) {
        promises.push(pool.addTask(idx));
    }
    const results = await Promise.all(promises);
    console.log(results);
    console.log('Exiting...')
    pool.exit();
}

const test_compressor = async () => {
    CompressAudio.compress({
        filePath: path.join(__dirname, './utils/data/game.mkv'),
        poolSize: 1
    });
}

test_compressor()