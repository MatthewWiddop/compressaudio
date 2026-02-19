const ffmpegPath = require('ffmpeg-static');
const { parse, join } = require('path')
const { parentPort } = require('worker_threads');
const { execSync } = require('child_process');

const fs = require('fs');

parentPort.on('message', async ({filePath, timingsPath, audioFormat}) => {
    const {dir, name} = parse(filePath);
    const outputPath = join(dir, name + '.' + audioFormat);
    try {
        execSync(`${ffmpegPath} -f concat -safe 0 -i ${timingsPath} ${outputPath}`, { maxBuffer: 1024 * 1024 * 10 });
        // add -threads n to limit threads
        parentPort.postMessage({ data: { 
            message: 'Task completed!',
            outputPath: outputPath
        }});
    }
    catch (err) {
        parentPort.postMessage({ error: err });
    }

});