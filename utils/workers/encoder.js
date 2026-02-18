const ffmpegPath = require('ffmpeg-static');
const { parse, join } = require('path')
const { parentPort } = require('worker_threads');
const { exec } = require('child_process');

const fs = require('fs');

parentPort.on('message', async ({filePath, timingsPath, audioFormat}) => {
    const {dir, name} = parse(filePath);
    const outputPath = join(dir, name + '.' + audioFormat);
    exec(`${ffmpegPath} -f concat -safe 0 -threads 1 -i ${timingsPath} ${outputPath}`, 
        {
            maxBuffer: 1024 * 1024 * 10
        }, (err) => {
        if(err) {
            parentPort.postMessage({ error: err });
        }
        else {
            parentPort.postMessage({ data: { 
                message: 'Task completed!',
                outputPath: outputPath
            }});
        }
    });
});