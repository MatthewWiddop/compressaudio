const { program } = require('commander');
const { parse, join } = require('path');
const Compressor = require('./Compressor');
const cliProgress = require('cli-progress');

const listAudio = () => {
  console.log('Supported audio formats...');
  Compressor.getSupportedAudioFileTypes().forEach(extension => {
    console.log(`+ ${extension}`)
  });
  console.log();
}

const listSubtitle = () => {
  console.log('Supported subtitle formats...');
  Compressor.getSupportedSubtitleFileTypes().forEach(extension => {
    console.log(`+ ${extension}`);
  });
  console.log();
}

const handleCompress = async (path, options) => {
  const multbar = new cliProgress.MultiBar({
    hideCursor: true,
    format: ' {bar} | {percent}% | {completed}/{total} | {stage} ',
    stopOnComplete: true,
    clearOnComplete: false,
    forceRedraw: true
  }, cliProgress.Presets.shades_grey);
  const bars = {};

  const logErrorMessage = (error) => {
    console.log();
    console.error('An error has occured...');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    console.error('Stage:', error.stage);
  }

  const emit = (data) => {
    switch (data.type) {
      case 'error':
        multbar.stop();
        logErrorMessage(data);
        break;
      case 'status':
        multbar.log(data.message + '\n');
        break;
      case 'warning':
        multbar.log(`Warning: ${data.message}\n`);
        break;
      case 'progress':
        let bar = bars[data.stage];
        if (!bar) {
          bar = multbar.create(data.total, data.complete, data);
          bars[data.stage] = bar;
          return;
        }
        bar.increment(1, data);
        if (data.complete >= data.total) {
          bar.stop();
        }
        break;
      default:
        logErrorMessage({
          type: 'error',
          code: 'Unhandled error',
          stage: 'N/A',
          message: `Emitter does not recognise type ${data.type}`
        });
    }
  }

  const { dir, name } = parse(path);
  if (options.directory) {
    const output = options.output || join(dir, name);
    await Compressor.compressDirectory(path, output, options.format, emit);
  } else {
    const output = options.output || join(dir, name + options.format);
    await Compressor.compressSingleFile(path, output, emit);
  }
  multbar.stop();
}

program
  .name('compressaudio')
  .description('A tool that compresses audio files by using subtitles to retain only the spoken segments.')
  .version('1.0.0');

program
  .command('compress')
  .description('compress an audio file')
  .argument('<path>', 'path to the file or directory')
  .option('-d --directory', 'indicates that the specified <path> is a directory', false)
  .option('-f --format <format>', 'sets the output file format, ignored if -d is set', '.mp3')
  .option('-o --output <output>', 'sets the output file or directory, defaults to <path>')
  .action(handleCompress);

program
  .command('list')
  .description('list supported audio or subtitle formats')
  .option('-a --audio', 'list supported audio formats')
  .option('-s --subtitle', 'list supported subtitle formats')
  .action((options) => {
    if (!options.audio || !options.subtitle) {
      console.error('Error: you must choose to list either audio or subtitle formats');
    }
    if (options.audio) {
      listAudio();
    }
    if (options.subtitle) {
      listSubtitle();
    }
  });

program.parse();
