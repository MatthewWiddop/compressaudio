const path = require('path');
const { isDirectory, isFile, endsWith } = require('./utils');
const fs = require('fs');
const ThreadPool = require('./ThreadPool');
const getProgressTracker = require('./getProgressTracker');

class Compressor {
  static fileTypePath = './filetypes.json';
	static getSupportedAudioFileTypes = () => require(this.fileTypePath).audio;
	static getSupportedSubtitleFileTypes = () => require(this.fileTypePath).subtitle;
  static #MAX_THREADS = 4;

  static #isSupportedFile(file, types) {
    return types.some(type => endsWith(file, type));
  }

  static isSupportedAudioFile(file) {
    return this.#isSupportedFile(file, this.getSupportedAudioFileTypes());
  }

  static isSupportedSubtitleFile(file) {
    return this.#isSupportedFile(file, this.getSupportedSubtitleFileTypes());
  }

  static #findCorrespondingSubtitleFile(parentDir, filename) {
    const supportedSubtitleFileTypes = this.getSupportedSubtitleFileTypes();
    for (let i = 0; i < supportedSubtitleFileTypes.length; i++) {
      const extension = supportedSubtitleFileTypes[i];
      const subtitlePath = path.join(parentDir, filename + extension);
      if (fs.existsSync(subtitlePath)) {
        return subtitlePath;
      }
    }
    return '';
  }

  static #getFileQueueEntry(entry, emit) {
    const filePath = path.join(entry.parentPath, entry.name);
    if (!entry.isFile() || !this.isSupportedAudioFile(filePath)) {
      return false;
    }
    const filename = path.parse(entry.name).name;
    const subtitlePath = this.#findCorrespondingSubtitleFile(entry.parentPath, filename);
    if (!subtitlePath) {
      emit({
        type: 'warning',
        code: 'File not Found',
        message: `No supported subtitle format found for the file.\nPath: ${filePath}`,
        stage: 'searching directory'
      });
      return false;
    }
    return { filePath, subtitlePath }
  }

	static async #parseDirectory(dirPath, emit) {
    emit({
      type: 'status',
      message: `Searching directory ${dirPath}...`,
      stage: 'searching directory'
    });
    const fileQueue = [];
    await fs.promises.readdir(dirPath, { withFileTypes: true })
      .then(entries => {
        entries.forEach(entry => {
          const fileQueueEntry = this.#getFileQueueEntry(entry, emit);
          if (fileQueueEntry) {
            fileQueue.push(fileQueueEntry);
          }
        });
      }).catch(err => {
        emit({
          type: 'error',
          code: 'Parsing error',
          message: `There was an error when parsing the directory ${dirPath}.\nError: ${err.message}`,
          stage: 'searching directory',
        });
      });
    if (fileQueue.length == 0) {
      emit({
        type: 'error',
        code: 'File not Found',
        message: `No valid audio files were found at the specified path.\nPath: ${dirPath}`,
        stage: 'searching directory',
      });
      return false;
    }
    return fileQueue;
	}

	static async #readSubtitles(fileQueue, emit) {
    emit({
      type: 'status',
      message: 'Reading subtitles...',
      stage: 'parsing subtitles'
    });
    const subtitleParser = path.join(__dirname, 'workers/subtitleParser.js');
    const pool = new ThreadPool({ filename: subtitleParser, size: this.#MAX_THREADS });
    const incrementProgressbar = getProgressTracker(fileQueue.length, emit, 'parsing subtitles');
    const tasks = fileQueue.map(item => 
      pool.addTask(item)
        .then((result) => { incrementProgressbar(); return result; })
    );

    const filesWithTimings = await Promise
      .all(tasks)
      .catch(err => {
        emit({
          type: 'error',
          code: 'Parsing error',
          message: err.message,
          stage: 'parsing subtitles',
        });
      });
    
    await pool.exit();
    return filesWithTimings;
	}

  static async #encodeAudio(encodingTasks, emit) {
    emit({
      type: 'status',
      message: 'Encoding audio...',
      stage: 'encoding audio'
    });
    const encoder = path.join(__dirname, 'workers/encoder.js');
    const pool = new ThreadPool({ filename: encoder, size: this.#MAX_THREADS });
    const incrementProgressbar = getProgressTracker(encodingTasks.length, emit, 'encoding audio');
    const tasks = encodingTasks.map(task =>
      pool.addTask(task)
        .then(() => { incrementProgressbar() }) 
    );

    await Promise
      .all(tasks)
      .catch(err => {
        emit({
          type: 'error',
          code: 'Encoding error',
          message: err.message,
          stage: 'audio encoding'
        });
      });
    await pool.exit();
  }

  static #getEncodingTasks(filesWithTimings, outputDir, outputFormat) {
    return filesWithTimings.map(file => ({
      ...file,
      outputPath: path.join(outputDir, path.parse(file.filePath).name + outputFormat)
    }));
  }

  static async #validateInputFile(file, emit) {
    const fileExists = await isFile(file);
    if (!fileExists) {
      emit({
        type: 'error',
        code: 'File not Found',
        message: `Could not find audio file at the specified path.\nPath: ${file}`,
        stage: 'initialisation',
      });
      return false;
    }
    if (!this.isSupportedAudioFile(file)) {
      emit({
        type: 'error',
        code: 'Unsupported File',
        message: `File is not a supported type.\nPath: ${file}`,
        stage: 'initialisation',
      });
      return false;
    }
    return true;
  }

  static async #validateOutputFile(file, emit) {
    const fileExists = await isFile(file);
    if (fileExists) {
      emit({
        type: 'error',
        code: 'File not Found',
        message: `Cannot produce output file at the specified path.\nPath: ${file} (file exists)`,
        stage: 'initialisation',
      });
      return false;
    }
    if (!this.isSupportedAudioFile(file)) {
      emit({
        type: 'error',
        code: 'Unsupported File',
        message: `Output file is not a supported type\nPath ${file}`,
        stage: 'initialisation',
      });
      return false;
    }
    return true;
  }

  static async #validateInputDirectory(dirPath, emit) {
    const directoryExists = await isDirectory(dirPath)
    if (!directoryExists) {
      emit({
        type: 'error',
        code: 'File not Found',
        message: `No directory was found at the specified path.\nPath: ${dirPath}`,
        stage: 'initialisation',
      });
      return false;
    }
    return true;
  }

  static async compressDirectory(file, output, outputFormat, emit) {
    const dirPath = path.resolve(file);
    const outputDir = path.resolve(output);
    const validDirectory = await this.#validateInputDirectory(outputDir, emit);
    if (!validDirectory) {
      return;
    }

    const fileQueue = await this.#parseDirectory(dirPath, emit);
    if (!fileQueue) {
      return;
    }

    const filesWithTimings = await this.#readSubtitles(fileQueue, emit);
    if (!filesWithTimings) {
      return;
    }

    const encodingTasks = this.#getEncodingTasks(filesWithTimings, outputDir, outputFormat);
    await this.#encodeAudio(encodingTasks, emit);
  }

  static async compressSingleFile(file, output, emit) {
    const filePath = path.resolve(file);
    const validInput = await this.#validateInputFile(filePath, emit);
    if (!validInput) {
      return;
    }

    const outputPath = path.resolve(output);
    const validOutput = await this.#validateOutputFile(outputPath, emit);
    if (!validOutput) {
      return;
    }

    const outputFormat = path.parse(outputPath).ext;
    const { dir: parentDir, name: filename } = path.parse(filePath);

    const subtitlePath = this.#findCorrespondingSubtitleFile(parentDir, filename);
    if (!subtitlePath) {
      emit({
        type: 'error',
        code: 'File not Found',
        message: `Could not find subtitles for the specified file.\nPath: ${filePath}`,
        stage: 'initialisation'
      });
      return;
    }

    const filesWithTimings = await this.#readSubtitles([{ filePath, subtitlePath }], emit);
    if (!filesWithTimings) {
      return;
    }
    
    const outputDir = path.parse(outputPath).dir;
    const encodingTasks = this.#getEncodingTasks(filesWithTimings, outputDir, outputFormat)
    await this.#encodeAudio(encodingTasks, emit);
  }
}

module.exports = Compressor;

