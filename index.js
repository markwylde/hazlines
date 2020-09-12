#!/usr/bin/env node

const { spawn } = require('child_process');

const getPort = require('get-port');
const chalk = require('chalk');
const WebSocket = require('ws');

const blackList = new RegExp('^internal[/].*|bin/npm-cli.js$|bin/yarn.js$');

getPort().then(port => {
  const cp = spawn('node', [`--inspect=127.0.0.1:${port}`, ...process.argv.slice(2)], {
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
      cp.stderr.pipe(process.stderr);
      cp.stderr.off('data', handleStdErr);
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
    console.log('  ' + trace.description);
    trace.callFrames
      .filter(frame => {
        return !frame.url.match(blackList);
      })
      .forEach(frame => {
        if (!frame.url.includes('file://')) {
          return false;
        }
        if (frame.url.includes('node_modules')) {
          console.log(chalk.grey(`    at ${frame.functionName || 'anonymous'} (` + frame.url.replace('file://', '') + ':' + (frame.lineNumber + 1) + ':' + (frame.columnNumber + 1) + ')'));
        } else {
          console.log(`    at ${frame.functionName || 'anonymous'} (` + frame.url.replace('file://', '') + ':' + (frame.lineNumber + 1) + ':' + (frame.columnNumber + 1) + ')');
        }
      });

    if (trace.parent) {
      logStackTrace(trace.parent);
    }
  }
  ws.on('message', function (rawData) {
    const data = JSON.parse(rawData);
    if (data.method === 'Debugger.paused') {
      if (!data.params.asyncStackTrace) {
        send({ method: 'Debugger.resume' });
        return;
      }
      console.log(data.params.data.description);
      logStackTrace(data.params.asyncStackTrace);
      process.exit(1);
    }
  });

  ws.on('open', async function () {
    await send({ method: 'Runtime.enable' });
    await send({ method: 'Runtime.setAsyncCallStackDepth', params: { maxDepth: 128 } });
    await send({ method: 'Debugger.enable', params: { maxScriptsCacheSize: 100000000 } });
    await send({ method: 'Debugger.setBlackboxPatterns', params: { patterns: ['^internal[/].*|bin/npm-cli.js$|bin/yarn.js$'] } });
    await send({ method: 'Debugger.setPauseOnExceptions', params: { state: 'uncaught' } });
  });
}
