const ffmpeg = require('ffmpeg');
const { parse, join } = require('path')
const { parentPort } = require('worker_threads');

parentPort.on('message', async ({id, filePath, subtitle}) => {
    const {dir, name} = parse(filePath);
    const outputPath = join(dir, name + id + '.avi');
    await new ffmpeg(filePath)
    .then((video) => {
        video.setDisableVideo();
        video.setVideoStartTime(subtitle.start / 1000);
        video.setVideoDuration((subtitle.end - subtitle.start) / 1000);
        video.addCommand('-threads', '2');
        video.save(outputPath); // no need to access output path
    }).then(() => {
        parentPort.postMessage({ data: { 
            message: 'Task completed!',
            outputPath: outputPath
        }});
    }).catch((err) => {
        parentPort.postMessage({ error: err });
    });
});