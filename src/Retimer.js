const { join } = require('path');
const ThreadPool = require('./ThreadPool');
const getProgressTracker = require('./getProgressTracker');
const { isNumber } = require('./utils');

class Retimer {
  static async retime(subtitlePaths, delta, emit, options) {
    if (!isNumber(delta)) {
      emit({
        type: 'error',
        code: 'Invalid input',
        message: 'Delta must be a number',
        stage: 'initialisation'
      });
      return;
    }
    const subtitleRetimer = join(__dirname, 'workers/subtitleRetimer.js');
    const pool = new ThreadPool({ filename: subtitleRetimer, size: options.threads ?? 4 });
    const incrementTracker = getProgressTracker(subtitlePaths.length, emit, 'retiming subtitles');

    return Promise
      .all(subtitlePaths.map(path => (
          pool.addTask({
            subtitlePath: path,
            delta,
            options
          }).then(result => { incrementTracker(); return result; })
      )))
      .finally(() => { pool.exit(); })
      .catch((err) => {
        emit({
          type: 'error',
          code: 'Retiming error',
          message: err.message,
          stage: 'retiming subtitles'
        });
      });
  }
}

module.exports = Retimer;
