const fs = require('fs/promises');

function asyncThing (connection, sql, parameters, callback) {
  return fs.readFile('index.js', 'utf8').then(a => {
    throw new Error('who knows what went wrong?');
  });
}

module.exports = asyncThing;
