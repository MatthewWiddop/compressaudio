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
  return prefix != '' && str.slice(0, prefix.length) == prefix;
}

const endsWith = (str, suffix) => {
  return suffix != '' && str.slice(-suffix.length) == suffix;
}

const getSeconds = (hours, minutes, seconds, milliseconds) => {
  let totalSeconds = seconds;
  totalSeconds += milliseconds / 1000;
  totalSeconds += minutes * 60;
  totalSeconds += hours * 360;
  return totalSeconds;
}

const lastElement = (arr) => {
  return arr[arr.length - 1];
}

// HH:MM:SS,mmm format to seconds
const srtTimestampToSeconds = (timestamp) => {
  const majorComponents = timestamp.split(':');
  const minorComponents = lastElement(majorComponents).split(',');
  const hours = Number(majorComponents[0]), minutes = Number(majorComponents[1]);
  const seconds = Number(minorComponents[0]), milliseconds = Number(minorComponents[1]);
  return getSeconds(hours, minutes, seconds, milliseconds);
}

// HH:MM:SS.mm format to seconds
const assTimestampToSeconds = (timestamp) => {
  const majorComponents = timestamp.split(':');
  const minorComponents = lastElement(majorComponents).split('.');
  const hours = Number(majorComponents[0]), minutes = Number(majorComponents[1]);
  const seconds = Number(minorComponents[0]), milliseconds = Number(minorComponents[1]);
  return getSeconds(hours, minutes, seconds, milliseconds);
}

module.exports = { isDirectory, isFile, startsWith, endsWith, lastElement, getSeconds, srtTimestampToSeconds, assTimestampToSeconds };

