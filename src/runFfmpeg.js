const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

module.exports = (ffmpegArgs) => new Promise((resolve, reject) => {
  const ffmpeg = spawn(ffmpegPath, ffmpegArgs);

  ffmpeg.on('error', reject);

  let stderr = '';
  ffmpeg.stderr.on('data', (data) => {
    stderr += data;
  });
  
  ffmpeg.on('close', (code) => {
    if (code == 0) {
      resolve();
    } else {
      reject(new Error(`Ffmpeg exited with status code ${code}\n${stderr}`));
    }
  });
});
