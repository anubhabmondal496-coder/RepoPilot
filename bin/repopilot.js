#!/usr/bin/env node

/**
 * RepoPilot CLI Launcher
 */
const path = require('path');
const fs = require('fs');

const distCli = path.join(__dirname, '..', 'dist', 'cli.js');

if (fs.existsSync(distCli)) {
  const { runCli } = require(distCli);
  runCli();
} else {
  // Fallback to TypeScript source execution or error if dist is not compiled
  console.error('✘ RepoPilot CLI distribution not found. Please run "npm run compile" first.');
  process.exit(1);
}
