#!/usr/bin/env node

import { spawn } from 'child_process';
import getPort from 'get-port';
import chalk from 'chalk';
import WebSocket from 'ws';

const blackList = new RegExp('^internal[/].*|bin/npm-cli.js$|bin/yarn.js$');

getPort().then(port => {
  const cp = spawn('node', ['--unhandled-rejections=strict', `--inspect=127.0.0.1:${port}`, ...process.argv.slice(2)], {
    stdio: [process.stdin, process.stdout, 'pipe']
  });

  function handleStdErr (rawData) {
    const data = rawData.toString();
    if (data.startsWith('Debugger listening on')) {
      const uri = data
        .substr('Debugger listening on'.length)
        .split('\n')[0]
        .trim();
      hookApp(uri);
    } else if (data.startsWith('Debugger attached')) {
      cp.stderr.on('data', rawData => {
        const data = rawData.toString();
        if (!data === 'Waiting for the debugger to disconnect...') {
          process.stderr.write(rawData);
        }
      });
      cp.stderr.off('data', handleStdErr);
    } else {
      process.stderr.write(rawData);
    }
  }

  cp.stderr.on('data', handleStdErr);
});

function hookApp (uri) {
  const ws = new WebSocket(uri);
  ws.on('open', () => {
    console.log(chalk.green('* hazlines activated'));
  });

  let id = 0;
  const handlers = {};
  function send (message) {
    id = id + 1;

    return new Promise((resolve, reject) => {
      handlers[id] = { resolve, reject };
      ws.send(JSON.stringify({
        id,
        ...message
      }));
    });
  }

  ws.on('message', function (rawData) {
    const data = JSON.parse(rawData);
    // console.log(JSON.stringify(data, null, 2))
    if (!data.id) {
      if (data.method === 'Debugger.scriptParsed') {
        return;
      }

      // console.log(JSON.stringify(data, null, 2))

      return;
    }

    handlers[data.id].resolve(data);
  });

  function logStackTrace (trace) {
    let lines = '\n  ' + chalk.yellow(trace.description || '') + '\n';
    lines = lines + trace.callFrames
      .filter(frame => {
        return !frame.url.match(blackList);
      })
      .filter(frame => {
        return frame.url.includes('file://');
      })
      .map(frame => {
        if (frame.url.includes('node_modules')) {
          return chalk.grey(`    at ${frame.functionName || 'anonymous'} (` + frame.url.replace('file://', '') + ':' + (frame.lineNumber + 1) + ':' + (frame.columnNumber + 1) + ')');
        } else {
          return `    at ${frame.functionName || 'anonymous'} (` + frame.url.replace('file://', '') + ':' + (frame.lineNumber + 1) + ':' + (frame.columnNumber + 1) + ')';
        }
      })
      .join('\n');

    if (trace.parent) {
      lines = lines + logStackTrace(trace.parent) + '\n';
    }

    return lines;
  }
  ws.on('message', async function (rawData) {
    const data = JSON.parse(rawData);
    // if (data.method !== 'Debugger.scriptParsed') {
    //   console.log(JSON.stringify(data, null, 2));
    // }

    if (data.method === 'Runtime.executionContextDestroyed') {
      ws.close();
      return;
    }

    if (data.method === 'Runtime.exceptionThrown') {
      console.log(data.params.exceptionDetails.exception.description);
    }

    if (data.method === 'Debugger.paused') {
      if (data.params.asyncStackTrace) {
        const stacktrace = logStackTrace(data.params.asyncStackTrace);
        await send({
          method: 'Runtime.callFunctionOn',
          params: {
            objectId: data.params.data.objectId,
            arguments: [
              { value: stacktrace }
            ],
            functionDeclaration: `
              function(stacktrace) {
                this.stack = this.stack + "\\n----------\\n" + stacktrace;
                this.stack = this.stack.replace(/\\n\\n/g, '\\n');
              }
            `,
            silent: true
          }
        });

        send({ method: 'Debugger.resume' });
      } else {
        send({ method: 'Debugger.resume' });
      }
    }
  });

  ws.on('open', async function () {
    await send({ method: 'Runtime.enable' });
    await send({ method: 'Runtime.setAsyncCallStackDepth', params: { maxDepth: 128 } });
    await send({ method: 'Debugger.enable', params: { maxScriptsCacheSize: 100000000 } });
    await send({ method: 'Log.disable' });
    await send({ method: 'Debugger.setPauseOnExceptions', params: { state: 'all' } });
  });
}
