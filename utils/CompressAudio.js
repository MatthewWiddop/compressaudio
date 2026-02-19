const fs = require('fs/promises');
const { createReadStream } = require('fs')
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
		const stats = await fs.stat(path).catch(this.#showError);
		return stats.isDirectory();
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
			else {
				this.#showError(new Error(`Not a supported file type: ${config.filePath}`));
			}
		}
		this.pool.exit();
	}
	
	static async #parseDirectory(dirPath) {
		const allFiles = await fs.readdir(dirPath).catch(this.#showError);
		const audioFiles = allFiles.filter((file) => this.isSupportedAudioFileType(file));
		const filePromises = []
		for(let idx = 0; idx < audioFiles.length; idx++) {
			filePromises.push(this.#compressFile(path.join(dirPath, audioFiles[idx])));
		}
		await Promise.all(filePromises)
	}
	
	static async #compressFile(filePath) {
		const subPath = await this.#findCorrespondingSubtitles(filePath);
		const subtitles = await this.#readSubtitles(subPath).catch(this.#showError);
		const timingsPath = await this.#createTimingsFile(filePath, subtitles);
		const { outputPath } = await this.pool.addTask({
			filePath: filePath,
			timingsPath: timingsPath,
			audioFormat: this.config.outputAudioFormat
		}).catch(this.#showError);
		await fs.unlink(timingsPath);
		return outputPath;
	}

	static async #createTimingsFile(inputPath, subtitles) {
		const { name, dir } = path.parse(inputPath);
		const outputPath = path.join(dir, `${name}-timings.txt`);
		console.log(outputPath)
		let output = '';
		subtitles.forEach(subtitle => {
			output += `file ${inputPath}\n`;
			output += `inpoint ${subtitle.start / 1000}\n`;
			output += `outpoint ${subtitle.end / 1000}\n`;
		});
		await fs.writeFile(outputPath, output)
		.catch(this.#showError);
		return outputPath;
	}
	
	static async #findCorrespondingSubtitles(filePath) {
		const {name, dir} = path.parse(filePath);
		const files = await fs.readdir(dir).catch(this.#showError);
		for(let idx = 0; idx < files.length; idx++) {
			var file = files[idx];
			if(this.isSupportedSubtitleFileType(file) &&
				path.parse(file).name == name) {
				return path.join(dir, file);
			}
		}
		return '';
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