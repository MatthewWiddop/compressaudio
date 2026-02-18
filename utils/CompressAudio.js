const fs = require('fs/promises');
const { createReadStream, createWriteStream } = require('fs')
const { parse } = require('subtitle');
const path = require('path')
const ThreadPool = require('./ThreadPool');

class CompressAudio {
	static supportedAudioFileTypes = ['mp3', 'mp4', 'mkv'];
	static supportedSubtitleFileTypes = ['srt', 'vtt'];
	static workingDirectory = '.';
	
	static #showError = (err) => {
		throw err;
	}

	static #isDirectory = async path => {
		fs.stat(path, async (_, stats) => {
			return stats.isDirectory();
		}).catch(this.#showError);
	}

	static isSupportedAudioFileType = filePath => {
		// TODO: test if this function accepts directories with dots
		// get file extension and remove dot
		let fileExt = path.extname(filePath)
		if (!fileExt) return false; // not a file
		fileExt = fileExt.slice(1);
		return this.supportedAudioFileTypes.some(
			(fileType) => fileExt == fileType
		);
	}

	static isSupportedSubtitleFileType = filePath => {
		let fileExt = path.extname(filePath);
		if (!fileExt) return false;
		fileExt = fileExt.slice(1);
		return this.supportedSubtitleFileTypes.some(
			(fileType) => fileExt == fileType
		);
	}

	static #validateConfig(config) {
		// TODO: input validation
		if (!config.filePath) {
			this.#showError(new Error('File path must be given'));
		}
		return true;
	}

	static async compress(config) {
		this.#validateConfig(config);
		this.config = {
			filePath: config.filePath,
			outputDirectory: config.outputDirectory || '.',
			outputAudioFormat: config.outputAudioFormat || 'mp3',
			poolSize: config.poolSize || 8
		}
		// calls individual functions
		// check if file or directory has been given 
		this.pool = new ThreadPool({
			filename: path.join(__dirname, './workers/encoder.js'),
			size: config.poolSize
		});
		if(await this.#isDirectory(config.filePath)) {
			await this.#parseDirectory(config.filePath);
		}
		else {
			if(this.isSupportedAudioFileType(config.filePath)) {
				await this.#compressFile(config.filePath);
			}
		}
		this.pool.exit();
	}
	
	static async #parseDirectory(dirPath) {
		return fs.readdir(dirPath, (_, files) => 
			files.filter((file) => {
				this.isSupportedAudioFileType(file);
			})
		).then(async (files) => {
			const filePromises = []
			for(let idx = 0; idx < files.length; idx++) {
				await this.#compressFile(files[idx]);		
			}
			await Promise.all(filePromises)
		}).catch(this.#showError);
	}
	
	static async #compressFile(filePath) {
		return new Promise(async (resolve) => {
			const subPath = await this.#findCorrespondingSubtitles(filePath);
			if(!subPath) {
				this.#showError(new Error(`No subtitles found corresponding to the file ${filePath}`))
			}
			const subtitles = await this.#readSubtitles(subPath);
			const timingsPath = '';
			await this.#createTimingsFile(filePath, outputPath, subtitles)
			let clipPromises = [];
			for(let idx = 0; idx < subtitles.length; idx++) {
				clipPromises.push(this.pool.addTask({
					id: idx,
					filePath: filePath,
					subtitle: subtitles[idx]
				}));
			}
			await Promise.all(clipPromises).then((output) => {
				console.log(output);
			});
			// finish thread side and combine results
			// ...
			resolve()
		});
	}

	static async #createTimingsFile(inputPath, outputPath, subtitles) {
		return new Promise((resolve, reject) => {
			if(fs.exists(outputPath, (exists) => {
				if(!exists) {
					reject(new Error(`File exists: ${outputPath}`));
				}
				let output = '';
				subtitles.forEach(subtitle => {
					output += `file ${inputPath}\n`;
					output += `inpoint ${subtitle.start / 1000}\n`;
					output += `outpoint ${subtitle.end / 1000}\n`;
				});
				console.log(output);
				// fs.writeFile(outputPath, )
			}));
		});
	}
	
	static async #findCorrespondingSubtitles(filePath) {
		const {name, dir} = path.parse(filePath);
		return fs.readdir(dir).then((files) => {
			for(let idx = 0; idx < files.length; idx++) {
				var file = files[idx];
				if(this.isSupportedSubtitleFileType(file) &&
				path.parse(file).name == name) {
					return path.join(dir, file);
				}
			}
			return '';
		}).catch(this.#showError);
	}

	static async #readSubtitles(subPath) {
		return new Promise((resolve, reject) => {
			let chunks = []
			createReadStream(subPath)
				.pipe(parse())
				.on('data', (chunk) => {
					chunks.push(chunk.data)
				})
				.on('error', reject)
				.on('finish', () => {
					resolve(chunks);
				});
		})
	}
}

module.exports = CompressAudio;