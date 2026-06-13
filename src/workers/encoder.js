const fs = require('fs');
const { parentPort } = require('worker_threads');
const runFfmpeg = require('../runFfmpeg');

parentPort.on('message', async ({ filePath, subtitles, outputPath }) => {
  fs.promises.access(outputPath)
    .then(() => {
      throw new Error(`Cannot compress ${filePath} to ${outputPath} (file already exists)`);
    })
    .catch((err) => {
      if (err.code == 'ENOENT') {
        return;
      }
      throw err;
    })
    .then(() => getFfmpegArgs(filePath, subtitles, outputPath))
    .then(runFfmpeg)
    .then(() => {
      parentPort.postMessage({
        data: {
          message: 'Task completed succesfully',
          outputPath
        }
      });
    })
    .catch((err) => { 
      parentPort.postMessage({ error: err })
    });
});

const getSegmentFilter = (subtitles) => {
  return subtitles.map(({ start, end }, idx) =>
    `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${idx}]`
  );
}

const getConcatFilter = (subtitles) => {
  const segmentCount = subtitles.length;
  return `${subtitles.map((_, idx) => `[a${idx}]`).join('')}concat=n=${segmentCount}:v=0:a=1[outa]`;
}

const getFilterGraph = (subtitles) => {
  return getSegmentFilter(subtitles).join(';') + ';' + getConcatFilter(subtitles);
}

const getFfmpegArgs = (inputPath, subtitles, outputPath) => {
  const filter = getFilterGraph(subtitles);
  return ['-i', inputPath, '-filter_complex', filter, '-map', '[outa]', outputPath];
}

