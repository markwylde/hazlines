const asyncThing = require('./asyncThing');

async function main () {
  setTimeout(() => {
    asyncThing();
  }, 250);
}
// throw new Error('oh noes')
main();
