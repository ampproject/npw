#!/usr/bin/env node
'use strict';

const { readFile: _readFile } = require('fs');
const { dirname, join, relative } = require('path');
const { spawn: _spawn } = require('child_process');

function readFile(path, opts) {
  return new Promise((resolve, reject) => {
    _readFile(path, opts, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function readPackageJson(dir) {
  try {
    const contents = await readFile(join(dir, 'package.json'), 'utf8');
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

async function findWorkspaceRoot(cwd) {
  let dir = cwd;
  for (let prevDir; dir != prevDir; prevDir = dir, dir = dirname(dir)) {
    const json = await readPackageJson(dir);
    if (json == null || !json.workspaces) continue;

    return dir;
  }

  return null;
}

function SIG(sig, cb) {
  function handler() {
    cb(sig);
  }
  process.on(sig, handler);
  return () => process.off(sig, handler);
}

function ctrlC(cb) {
  const cleanupSigInt = SIG('SIGINT', cb);
  const cleanupSigTerm = SIG('SIGTERM', cb);
  const cleanupSigQuit = SIG('SIGQUIT', cb);
  return () => {
    cleanupSigInt();
    cleanupSigTerm();
    cleanupSigQuit();
  };
}

class ExitError extends Error {
  constructor(exitCode, message) {
    super(message);
    this.exitCode = exitCode;
  }
}

async function spawn(cmd, args, opts) {
  let child;
  let exitCode = 0;
  const cleanup = ctrlC((sig) => {
    if (child) child.kill(sig);
    exitCode = 2;
  });

  try {
    await new Promise((resolve, reject) => {
      child = _spawn(cmd, args, opts);

      child.on('error', reject);
      child.on('close', (code) => {
        child = null;

        if (exitCode || code) {
          reject(new ExitError(exitCode || code));
        } else {
          resolve();
        }
      });
    });
  } finally {
    cleanup();
  }
}

function parseArgs() {
  const {argv} = process;
  let quiet = false;
  let shell = process.platform === 'win32';

  let i = 2;
  for (; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      i++;
      break;
    }

    if (arg === '--quiet') {
      quiet = true;
      continue;
    }

    if (arg === '--shell') {
      shell = argv[++i];
      continue;
    } else if (arg.startsWith('--shell=')) {
      shell = arg.slice('--shell='.length);
      continue;
    }

    // Unknown arg
    break;
  }

  return {
    quiet,
    shell,
    args: argv.slice(i),
  };
}

async function npw() {
  const {quiet, shell, args} = parseArgs();
  if (args.length === 0) {
    console.error('Usage:');
    console.error('npw [--quiet] [--shell=...] [...]');
    console.error('');
    console.error('Options:');
    console.error('    --quiet           silence output from npw');
    console.error('    --shell shell     a custom shell to spawn npm inside');
    process.exit(1);
  }

  const cwd = process.cwd();
  const root = await findWorkspaceRoot(cwd);

  if (root == null) {
    console.error('Failed to find workspace root');
    process.exit(1);
  }


  if (root === cwd) {
    if (!quiet) console.log('Found workspace root at current directory');
  } else {
    const workspace = relative(root, cwd);
    args.splice(1, 0, '-w', workspace);
    if (!quiet) console.log(`Executing in workspace ${workspace}`);
  }

  try {
    await spawn('npm', args, {
      cwd: root,
      env: process.env,
      shell: shell,
      stdio: 'inherit',
    });
  } catch (e) {
    if (!e.exitCode) throw e;
    process.exit(e.exitCode);
  }
};

npw();
