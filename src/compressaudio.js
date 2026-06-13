const { program } = require('commander');
const { parse, join } = require('path');
const CompressAudio = require('./CompressAudio');

const listAudio = () => {
  console.log('Supported audio formats...');
  CompressAudio.supportedAudioFileTypes.forEach(extension => {
    console.log(`+ ${extension}`)
  });
  console.log();
}

const listSubtitle = () => {
  console.log('Supported subtitle formats...');
  CompressAudio.supportedSubtitleFileTypes.forEach(extension => {
    console.log(`+ ${extension}`);
  });
  console.log();
}

program
  .name('compressaudio')
  .description('A tool that compresses audio files by using subtitles to retain only the spoken segments.')
  .version('0.1.0');

program
  .command('compress')
  .description('compress an audio file')
  .argument('<path>', 'path to the file or directory')
  .option('-d --directory', 'indicates that the specified <path> is a directory', false)
  .option('-f --format <format>', 'sets the output file format, ignored if -d is set', '.mp3')
  .option('-o --output <output>', 'sets the output file or directory, defaults to <path>')
  .action(async (path, options) => {
    const { dir, name } = parse(path);
    if (options.directory) {
      const output = options.output || join(dir, name);
      await CompressAudio.compressDirectory(path, output, options.format);
    } else {
      const output = options.output || join(dir, name + options.format);
      await CompressAudio.compressSingleFile(path, output);
    }
  });

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

// todo:
// - add option to adjust subtitle timings (and option to skip)
// - test the code, for both routes:
// + random string input
// + valid path with no subtitle file 
// + valid path and subtitle file format
// + valid file and other subtitle format

program.parse();
