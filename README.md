# hazlines
Turn this useless message:

```bash
$ node example

(node:95263) UnhandledPromiseRejectionWarning: Error: who knows what went wrong?
    at /app/project/asyncThing.js:5:11
(Use `node --trace-warnings ...` to show where the warning was created)
(node:95263) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). To terminate the node process on unhandled promise rejection, use the CLI flag `--unhandled-rejections=strict` (see https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode). (rejection id: 1)
(node:95263) [DEP0018] DeprecationWarning: Unhandled promise rejections are deprecated. In the future, promise rejections that are not handled will terminate the Node.js process with a non-zero exit code.
```

Into this:

```bash
$ hazlines example
  Promise.then
    at asyncThing (/app/project/asyncThing.js:4:42)
    at anonymous (/app/project/index.js:5:5)
  Timeout
    at setTimeout (timers.js:157:19)
    at main (/app/project/index.js:4:3)
    at anonymous (/app/project/index.js:9:1)
```
