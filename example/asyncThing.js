import fs from 'fs/promises';

function asyncThing (connection, sql, parameters, callback) {
  process.stderr.write('oh noes\n');
  return fs.readFile('index.js', 'utf8').then(a => {
    throw new Error('who knows what went wrong?');
  });
}

export default asyncThing;
