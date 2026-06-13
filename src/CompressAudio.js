const path = require("path");
const { isDirectory, isFile, endsWith } = require("./utils");
const fs = require('fs');
const ThreadPool = require("./ThreadPool");

class CompressAudio {
	static outputDirectory = '.';
	static supportedAudioFileTypes = ['.mp3', '.mp4', '.mkv'];
	static supportedSubtitleFileTypes = ['.srt', '.ass'];
  static #MAX_THREADS = 4;

  static #isSupportedFile(file, types) {
    return types.some(type => endsWith(file, type));
  }

  static isSupportedAudioFile(file) {
    return this.#isSupportedFile(file, this.supportedAudioFileTypes);
  }

  static isSupportedSubtitleFile(file) {
    return this.#isSupportedFile(file, this.supportedSubtitleFileTypes);
  }

  static #findCorrespondingSubtitleFile(parentDir, filename) {
    for (let i = 0; i < this.supportedSubtitleFileTypes.length; i++) {
      const extension = this.supportedSubtitleFileTypes[i];
      const subtitlePath = path.join(parentDir, filename + extension);
      if (fs.existsSync(subtitlePath)) {
        return subtitlePath;
      }
    }
    return '';
  }

  static #getFileQueueEntry(entry) {
    const filePath = path.join(entry.parentPath, entry.name);
    if (!entry.isFile() || !this.isSupportedAudioFile(filePath)) {
      return false;
    }
    const filename = path.parse(entry.name).name;
    const subtitlePath = this.#findCorrespondingSubtitleFile(entry.parentPath, filename);
    if (!subtitlePath) {
      console.log(`Warning: no supported subtitle format found for the file at ${filePath}`);
      return false;
    }
    return { filePath, subtitlePath }
  }

	static async #parseDirectory(dirPath) {
    const fileQueue = [];
    await fs.promises.readdir(dirPath, { withFileTypes: true })
      .then(entries => {
        entries.forEach(entry => {
          const fileQueueEntry = this.#getFileQueueEntry(entry);
          if (fileQueueEntry) {
            fileQueue.push(fileQueueEntry);
          }
        });
      }).catch(err => {
        console.error(`There was an error when parsing the directory ${dirPath}\nError: ${err}`);
      })
    return fileQueue;
	}

	static async #readSubtitles(fileQueue) {
    const subtitleParser = path.join(__dirname, 'workers/subtitleParser.js');
    const pool = new ThreadPool({ filename: subtitleParser, size: this.#MAX_THREADS });
    const tasks = [];
    fileQueue.forEach(item => {
      tasks.push(pool.addTask(item));
    });

    const filesWithTimings = await Promise
      .all(tasks)
      .catch(err => {
        console.error(`An error occured while processing a file: ${err.message}`);
      });
    
    await pool.exit();
    return filesWithTimings;
	}

  static async #encodeAudio(encodingTasks) {
    const encoder = path.join(__dirname, 'workers/encoder.js');
    const pool = new ThreadPool({ filename: encoder, size: this.#MAX_THREADS });
    const tasks = [];
    encodingTasks.forEach(task => {
      tasks.push(pool.addTask(task));
    });

    await Promise
      .all(tasks)
      .catch(err => {
        console.error(err)
      });
    
    await pool.exit();
  }

  static #getEncodingTasks(filesWithTimings, outputDir, outputFormat) {
    return filesWithTimings.map(file => ({
      ...file,
      outputPath: path.join(outputDir, path.parse(file.filePath).name + outputFormat)
    }));
  }

  static async #validateInputFile(file) {
    const fileExists = await isFile(file);
    if (!fileExists) {
      console.error(`Error: could not find audio file at the specified path: ${file}`);
      return false;
    }
    if (!this.isSupportedAudioFile(file)) {
      console.error(`Error: ${file} is not a supported file type`);
      return false;
    }
    return true;
  }

  static async #validateOutputFile(file) {
    const fileExists = await isFile(file);
    if (fileExists) {
      console.error(`Error: cannot produce output file at the specified path: ${file} (file exists)`);
      return false;
    }
    if (!this.isSupportedAudioFile(file)) {
      console.error(`Error: ${file} is not a supported audio output type`);
      return false;
    }
    return true;
  }

  static #validateInputDirectory(dirPath) {
    if (!isDirectory(dirPath)) {
      console.error(`Error: no file or directory was found at the specified path: ${dirPath}`);
      return false;
    }
    return true;
  }

  static async compressDirectory(file, output, outputFormat) {
    const dirPath = path.resolve(file);
    const outputDir = path.resolve(output);
    if (!this.#validateInputDirectory(outputDir)) {
      return;
    }

    const fileQueue = await this.#parseDirectory(dirPath);
    if (!fileQueue) {
      console.error(`Error: no satisfying audio files were found at the corresponding path ${dirPath}`);
      return;
    }

    const filesWithTimings = await this.#readSubtitles(fileQueue);
    if (!filesWithTimings) {
      return;
    }

    const encodingTasks = this.#getEncodingTasks(filesWithTimings, outputDir, outputFormat);
    await this.#encodeAudio(encodingTasks);
  }

  static async compressSingleFile(file, output) {
    const filePath = path.resolve(file);
    if (!this.#validateInputFile(filePath)) {
      return;
    }

    const outputPath = path.resolve(output);
    if (!this.#validateOutputFile(outputPath)) {
      return;
    }

    const outputFormat = path.parse(outputPath).ext;
    const { dir: parentDir, name: filename } = path.parse(filePath);

    const subtitlePath = this.#findCorrespondingSubtitleFile(parentDir, filename);
    if (!subtitlePath) {
      console.error(`Error: could not find corresponding subtitle file for ${filePath}`);
      return;
    }

    const filesWithTimings = await this.#readSubtitles([{ filePath, subtitlePath }]);
    if (!filesWithTimings) {
      return;
    }
    
    const outputDir = path.parse(outputPath).dir;
    const encodingTasks = this.#getEncodingTasks(filesWithTimings, outputDir, outputFormat)
    await this.#encodeAudio(encodingTasks);
  }
}

module.exports = CompressAudio;

