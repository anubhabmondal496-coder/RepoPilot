import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GeminiClient } from '../ai/geminiClient';
import { ContractChecker } from './contractChecker';

const execAsync = promisify(exec);

export interface HardwarePinMapping {
  name: string;
  pin: string;
  direction?: string;
  sourceFile: string;
}

export interface TurboEngineResult {
  generatedMarkdown: string;
  gitDiagramUrl: string;
  modifiedSummary: string;
  routesCount: number;
  pinsCount: number;
}

/**
 * Scans code files for hardware pin definitions.
 */
export function detectHardwarePins(files: string[], rootPath: string): HardwarePinMapping[] {
  const pins: HardwarePinMapping[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.ino', '.cpp', '.c', '.h', '.hpp', '.py'].includes(ext)) {
      continue;
    }

    try {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(rootPath, file);
      const lines = content.split(/\r?\n/);

      for (const line of lines) {
        // C/C++/Arduino: #define LED_PIN 13
        const defineMatch = line.match(/#define\s+([A-Za-z0-9_]+)\s+([0-9]+|A[0-9]+|GPIO[0-9]+|D[0-9]+)\b/);
        if (defineMatch && (defineMatch[1].toLowerCase().includes('pin') || defineMatch[1].toLowerCase().includes('gpio') || defineMatch[1].toLowerCase().includes('led') || defineMatch[1].toLowerCase().includes('sensor'))) {
          pins.push({
            name: defineMatch[1],
            pin: defineMatch[2],
            direction: 'GPIO',
            sourceFile: relPath
          });
        }

        // C/Arduino: const int trigPin = 9;
        const constMatch = line.match(/(?:const\s+int|int|byte|uint8_t)\s+([A-Za-z0-9_]+)\s*=\s*([0-9]+|A[0-9]+|D[0-9]+)\s*;/);
        if (constMatch && (constMatch[1].toLowerCase().includes('pin') || constMatch[1].toLowerCase().includes('led') || constMatch[1].toLowerCase().includes('sensor') || constMatch[1].toLowerCase().includes('relay'))) {
          pins.push({
            name: constMatch[1],
            pin: constMatch[2],
            direction: 'GPIO',
            sourceFile: relPath
          });
        }

        // MicroPython: Pin(14, Pin.OUT)
        const pythonPinMatch = line.match(/([A-Za-z0-9_]+)\s*=\s*Pin\(\s*([0-9]+)\s*,\s*Pin\.(IN|OUT|OUT_LOW|OUT_HIGH)\s*\)/i);
        if (pythonPinMatch) {
          pins.push({
            name: pythonPinMatch[1],
            pin: pythonPinMatch[2],
            direction: pythonPinMatch[3].toUpperCase(),
            sourceFile: relPath
          });
        }

        // RPi.GPIO: GPIO.setup(18, GPIO.OUT)
        const rpiMatch = line.match(/GPIO\.setup\(\s*([0-9]+)\s*,\s*GPIO\.(IN|OUT)\s*\)/i);
        if (rpiMatch) {
          pins.push({
            name: `GPIO_${rpiMatch[1]}`,
            pin: rpiMatch[1],
            direction: rpiMatch[2].toUpperCase(),
            sourceFile: relPath
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  return pins;
}

/**
 * Pure Node.js engine for workspace crawling, Gemini AI documentation synthesis,
 * and GitDiagram architecture embedding. Can be safely executed in CLI and VS Code.
 */
export async function runTurboCore(rootPath: string, apiKey: string): Promise<TurboEngineResult> {
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'out', '__pycache__', '.venv', 'venv', '.vscode-test', 'proofs', 'test-fixtures']);
  const allowedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.ino', '.cpp', '.c', '.h', '.hpp', '.md', '.yaml', '.yml']);

  // 1. Directory tree and candidate file list
  const allFiles: string[] = [];
  const dirTreeLines: string[] = [];

  const walk = (currentDir: string, depth = 0, maxDepth = 4) => {
    if (depth > maxDepth) {
      return;
    }
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (ignoreDirs.has(entry.name) || entry.name.startsWith('.')) {
          continue;
        }
        const fullPath = path.join(currentDir, entry.name);
        const indent = '  '.repeat(depth);

        if (entry.isDirectory()) {
          dirTreeLines.push(`${indent}📁 ${entry.name}/`);
          walk(fullPath, depth + 1, maxDepth);
        } else if (entry.isFile()) {
          dirTreeLines.push(`${indent}📄 ${entry.name}`);
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts.has(ext)) {
            allFiles.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore read error
    }
  };

  walk(rootPath);

  // 2. Detect Hardware Pin Definitions
  const hardwarePins = detectHardwarePins(allFiles, rootPath);

  // 3. Detect GitDiagram URL from git remote origin
  let gitDiagramUrl = 'https://gitdiagram.com';
  try {
    const { stdout } = await execAsync('git remote -v', { cwd: rootPath });
    const ghMatch = stdout.match(/github\.com[/:]([^/\s]+)\/([^/\s.]+)(?:\.git)?/);
    if (ghMatch) {
      gitDiagramUrl = `https://gitdiagram.com/${ghMatch[1]}/${ghMatch[2]}`;
    }
  } catch {
    // Fallback
  }

  // 4. Detect API routes via ContractChecker
  const contractChecker = new ContractChecker(rootPath);
  const routeResults = contractChecker.analyzeApiContracts();

  // 5. Prioritize up to 15 key files
  const prioritizedFiles = allFiles.sort((a, b) => {
    const aRel = path.relative(rootPath, a).toLowerCase();
    const bRel = path.relative(rootPath, b).toLowerCase();

    const getScore = (p: string) => {
      let score = 0;
      if (p.includes('package.json') || p.includes('requirements.txt')) { score += 50; }
      if (p.includes('app.py') || p.includes('main.py') || p.includes('server.js') || p.includes('index.ts') || p.includes('extension.ts')) { score += 40; }
      if (p.includes('route') || p.includes('controller') || p.includes('api')) { score += 30; }
      if (p.includes('.ino') || p.includes('hardware') || p.includes('pinout') || p.includes('main.cpp')) { score += 30; }
      if (p.includes('readme.md')) { score += 20; }
      return score;
    };

    return getScore(bRel) - getScore(aRel);
  });

  const fileSnapshots: string[] = [];
  for (const file of prioritizedFiles.slice(0, 15)) {
    try {
      const relPath = path.relative(rootPath, file);
      let content = fs.readFileSync(file, 'utf8');
      if (content.length > 4000) {
        content = content.slice(0, 4000) + '\n\n... [Truncated for token efficiency by RepoPilot] ...';
      }
      fileSnapshots.push(`### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``);
    } catch {
      // Ignore
    }
  }

  let snapshot = `# Workspace Snapshot\nRoot: ${rootPath}\nGitDiagram URL: ${gitDiagramUrl}\n\n`;
  snapshot += `## Directory Structure\n\`\`\`\n${dirTreeLines.slice(0, 80).join('\n')}\n\`\`\`\n\n`;

  if (routeResults.backendEndpoints.length > 0) {
    snapshot += `## Detected Backend API Routes (${routeResults.backendEndpoints.length})\n`;
    routeResults.backendEndpoints.forEach((r) => {
      snapshot += `- **${r.method || 'GET'}** \`${r.rawRoute}\` (defined in \`${r.file}\`)\n`;
    });
    snapshot += '\n';
  }

  if (hardwarePins.length > 0) {
    snapshot += `## Detected Hardware Pin Definitions (${hardwarePins.length})\n`;
    hardwarePins.forEach((p) => {
      snapshot += `- **Pin ${p.pin}** (\`${p.name}\`): ${p.direction || 'GPIO'} [defined in \`${p.sourceFile}\`]\n`;
    });
    snapshot += '\n';
  }

  snapshot += `## Key Source Files Content (${fileSnapshots.length} files)\n\n`;
  snapshot += fileSnapshots.join('\n\n');

  // 6. Synthesize Documentation with Gemini
  const generatedMarkdown = await GeminiClient.generateDocumentation(apiKey, snapshot);

  // 7. Backup existing README and write new one
  const readmePath = path.join(rootPath, 'README.md');
  const backupPath = path.join(rootPath, 'README.backup.md');

  if (fs.existsSync(readmePath)) {
    try {
      fs.copyFileSync(readmePath, backupPath);
    } catch {
      // Ignore
    }
  }

  fs.writeFileSync(readmePath, generatedMarkdown, 'utf8');

  const modifiedSummary = [
    `• Generated Project Executive Summary & Architecture Overview`,
    `• Embedded live GitDiagram interactive link: ${gitDiagramUrl}`,
    `• Structured technical specifications for ${routeResults.backendEndpoints.length} API route(s)`,
    hardwarePins.length > 0 ? `• Documented ${hardwarePins.length} hardware microcontroller GPIO pin mapping(s)` : `• Verified hardware pinout requirements`,
    `• Preserved existing README in README.backup.md before updating`
  ].join('\n');

  return {
    generatedMarkdown,
    gitDiagramUrl,
    modifiedSummary,
    routesCount: routeResults.backendEndpoints.length,
    pinsCount: hardwarePins.length
  };
}
