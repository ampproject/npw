#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn: _spawn } = require('child_process');

function readFile(path, opts) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, opts, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function readPackageJson(dir) {
  try {
    const contents = await readFile(path.join(dir, 'package.json'), 'utf8');
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

async function findWorkspaceRoot(cwd) {
  let dir = cwd;
  for (let prevDir; dir != prevDir; prevDir = dir, dir = path.dirname(dir)) {
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

async function npw() {
  const cwd = process.cwd();
  const root = await findWorkspaceRoot(cwd);

  if (root == null) {
    console.error('Failed to find workspace root');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (root !== cwd) {
    const workspace = path.relative(root, cwd);
    args.splice(1, 0, '-w', workspace);
  }

  try {
    await spawn('npm', args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    });
  } catch (e) {
    if (!e.exitCode) throw e;
    process.exit(e.exitCode);
  }
};

npw();
