const { parentPort } = require('worker_threads');
const path = require('path');
const fs = require('node:fs/promises');
const { 
  isFile, 
  startsWith, 
  endsWith, 
  assTimestampToSeconds, 
  srtTimestampToSeconds, 
  secondsToSrtTimestamp, 
  secondsToAssTimestamp 
} = require('../utils');

const subtitleHandlers = {
  '.ass': async (subtitlePath, delta) => (
    fs.readFile(subtitlePath, 'utf-8')
      .then(content => {
        const lines = content.split('\n');
        for (let idx = 0; idx < lines.length; idx++) {
          if (startsWith(lines[idx], 'Dialogue')) {
            const components = lines[idx].split(',');
            const startTime = assTimestampToSeconds(components[1]);
            const endTime = assTimestampToSeconds(components[2]);
            components[1] = secondsToAssTimestamp(startTime + delta);
            components[2] = secondsToAssTimestamp(endTime + delta);
            lines[idx] = components.join(',');
          }
        }
        return lines.join('\n');
      })
  ),
  '.srt': async (subtitlePath, delta) => (
    fs.readFile(subtitlePath, 'utf-8')
      .then(content => {
        const lines = content.split('\n');
        for (let idx = 0; idx < lines.length; idx++) {
          if (lines[idx].includes('-->')) {
            const times = lines[idx].split('-->');
            const startTime = srtTimestampToSeconds(times[0]);
            const endTime = srtTimestampToSeconds(times[1]);
            times[0] = secondsToSrtTimestamp(startTime + delta);
            times[1] = secondsToSrtTimestamp(endTime + delta);
            lines[idx] = times.join(' --> ');
          }
        }
        return lines.join('\n');
      })
  )
}
const supportedSubtitleTypes = Object.keys(subtitleHandlers);

parentPort.on('message', async (msg) => {
  const fullPath = path.resolve(msg.subtitlePath);
  validateSubtitleFile(fullPath)
    .then(fileType => (
      subtitleHandlers[fileType](fullPath, msg.delta)
    ))
    .then(newContent => (
      fs.writeFile(fullPath, newContent, 'utf-8')
    ))
    .then(() => {
      parentPort.postMessage({
        data: {
          type: 'status',
          message: `Adjusted timings for ${msg.subtitlePath}`
        }
      });
    })
    .catch((err) => {
      parentPort.postMessage({ error: err.message });
    });
});

const validateSubtitleFile = async (subtitlePath) => {
  const fileExists = await isFile(subtitlePath);
  if (!fileExists) {
    throw new Error({
      type: 'error',
      code: 'File not Found',
      message: `No file found at the specified path.\nPath: ${subtitlePath}`,
      stage: 'initialisation'
    });
  }
  const fileType = supportedSubtitleTypes.find(type => endsWith(subtitlePath, type));
  if (!fileType) {
    throw new Error({
      type: 'error',
      code: 'Unsupported File',
      message: `File is not a supported type.\nPath: ${subtitlePath}`,
      stage: 'initialisation'
    });
  }
  return fileType;
}

