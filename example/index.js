import asyncThing from './asyncThing.js';

async function main () {
  setTimeout(() => {
    asyncThing();
  }, 250);
}
// throw new Error('oh noes')
main();
