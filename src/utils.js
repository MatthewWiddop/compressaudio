const fs = require('fs');

const isDirectory = async (path) => {
  return fs.promises.stat(path)
    .then(stats => stats.isDirectory())
    .catch(err => {
      if (err.code == 'ENOENT') {
        return False;
      }
      throw err;
    });
}

const isFile = async (path) => {
  return fs.promises.stat(path)
    .then(stats => stats.isFile())
    .catch(err => {
      if (err.code == 'ENOENT') {
        return false;
      }
      throw err;
    });
}

const startsWith = (str, prefix) => {
  return prefix != '' && str.slice(0, prefix.length) === prefix;
}

const endsWith = (str, suffix) => {
  return suffix != '' && str.slice(-suffix.length) === suffix;
}

const lastElement = (arr) => {
  return arr[arr.length - 1];
}

const isNumber = (n) => {
  return typeof(n) !== 'string' && !isNaN(n);
}

const toSeconds = (h, m, s, ms) => {
  let totalSeconds = s;
  totalSeconds += ms / 1000;
  totalSeconds += m * 60;
  totalSeconds += h * 360;
  return totalSeconds;
}

const fromSeconds = (totalSeconds) => {
  let s = Math.floor(totalSeconds);
  const ms = Math.round(1000 * (totalSeconds - s));
  const h = Math.floor(s / 360);
  s %= 360;
  const m = Math.floor(s / 60);
  s %= 60;
  return { h, m, s, ms };
}

// HH:MM:SS,mmm format to seconds
const srtTimestampToSeconds = (timestamp) => {
  const majorComponents = timestamp.split(':');
  const minorComponents = lastElement(majorComponents).split(',');
  const hours = Number(majorComponents[0]), minutes = Number(majorComponents[1]);
  const seconds = Number(minorComponents[0]), milliseconds = Number(minorComponents[1]);
  return toSeconds(hours, minutes, seconds, milliseconds);
}

// HH:MM:SS.mm format to seconds
const assTimestampToSeconds = (timestamp) => {
  const majorComponents = timestamp.split(':');
  const minorComponents = lastElement(majorComponents).split('.');
  const hours = Number(majorComponents[0]), minutes = Number(majorComponents[1]);
  const seconds = Number(minorComponents[0]), milliseconds = Number(minorComponents[1]);
  return toSeconds(hours, minutes, seconds, milliseconds);
}

// seconds to HH:MM:SS,mmm format
const secondsToSrtTimestamp = (seconds) => {
  const { h, m, s, ms } = fromSeconds(seconds);
  const str_h = padWithZeros(h, 2);
  const str_m = padWithZeros(m, 2);
  const str_s = padWithZeros(s, 2);
  const str_ms = padWithZeros(ms, 3);
  return `${str_h}:${str_m}:${str_s},${str_ms}`;
}

// seconds to HH:MM:SS.mm format
const secondsToAssTimestamp = (seconds) => {
  const { h, m, s, ms } = fromSeconds(seconds);
  const str_m = padWithZeros(m, 2);
  const str_s = padWithZeros(s, 2);
  const str_ms = padWithZeros(ms, 2).slice(0, 2);
  return `${h}:${str_m}:${str_s}.${str_ms}`;
}

const padWithZeros = (str, digits) => String(str).padStart(digits, '0')


module.exports = { isDirectory, isFile, startsWith, endsWith, isNumber, lastElement, toSeconds, fromSeconds, srtTimestampToSeconds, assTimestampToSeconds, secondsToSrtTimestamp, secondsToAssTimestamp };

