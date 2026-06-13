const { parentPort } = require('worker_threads');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { startsWith, assTimestampToSeconds, srtTimestampToSeconds } = require('../utils');

parentPort.on('message', async ({ filePath, subtitlePath }) => {
  getSubtitles(subtitlePath)
    .then(subtitles => {
      parentPort.postMessage({ 
        data: { 
          filePath,
          subtitles 
        }
      });
    })
    .catch(err => {
      parentPort.postMessage({ error: err });
    });
});

const getSubtitles = (subtitlePath) => new Promise(async (resolve, reject) => {
  if (!fs.existsSync(subtitlePath)) {
    reject(`Cannot find subtitles at the specified path ${subtitlePath} for the file ${filePath}`);
    return;
  }

  const timings = [];
  const fileHandlers = { '.srt': handleSrt, '.ass': handleAss };
  const fileExtension = path.parse(subtitlePath).ext;
  const fileHandler = fileHandlers[fileExtension];
  if (!fileHandler) {
    reject(`Unsupported subtitle file detected at ${subtitlePath} (file extension: ${fileExtension})`);
    return;
  }

  const stream = fs.createReadStream(subtitlePath);
  const reader = readline.createInterface({
    input: stream
  });
  fileHandler(reader, timings, err => {
    if (err) {
      reject(err);
      return;
    }
    mergeOverlappingClips(timings);
    resolve(timings);
  });
});

const handleSrt = (reader, timings, callback) => {
  reader.on('line', (line) => {
    if (line.includes('-->')) {
      // expected time format: HH:MM:SS,mmm
      const times = line.split('-->');
      const startTime = srtTimestampToSeconds(times[0]);
      const endTime = srtTimestampToSeconds(times[1]);
      timings.push({ start: startTime, end: endTime }); 
    }
  });
  reader.on('close', () => {
    callback(false);
  });
}

const handleAss = (reader, timings, callback) => {
  reader.on('line', (line) => {
    if (startsWith(line, 'Dialogue')) {
      // expected time format: H:MM:SS.cc
      const dialogue = line.split(',');
      const startTime = assTimestampToSeconds(dialogue[1]);
      const endTime = assTimestampToSeconds(dialogue[2]);
      timings.push({ start: startTime, end: endTime });
    }
  });
  reader.on('close', () => {
    callback(false);
  });
}

const sortClipsAscending = (a, b) => a.start - b.start;

const mergeOverlappingClips = (timings) => {
  timings.sort(sortClipsAscending);
  let insertIdx = 0, i = 0;
  for (i; insertIdx < timings.length; i++) {
    timings[i].start = timings[insertIdx].start;
    let newEnd = timings[insertIdx++].end;
    while (insertIdx < timings.length && newEnd > timings[insertIdx].start) {
      newEnd = timings[insertIdx++].end;
    }
    timings[i].end = newEnd;
  }
  timings.splice(i);
}

