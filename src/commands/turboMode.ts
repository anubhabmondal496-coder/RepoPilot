import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GeminiClient } from '../ai/geminiClient';
import { ContractChecker } from '../services/contractChecker';

const execAsync = promisify(exec);

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: GitRepository[];
}

interface GitRepository {
  rootUri: vscode.Uri;
  state: {
    remotes: Array<{ name: string; fetchUrl?: string; pushUrl?: string }>;
    HEAD?: { name?: string; upstream?: { name: string } };
  };
  add(paths: string[]): Promise<void>;
  commit(message: string): Promise<void>;
  push(remoteName?: string, branchName?: string, setUpstream?: boolean): Promise<void>;
}

export interface HardwarePinMapping {
  name: string;
  pin: string;
  direction?: string;
  sourceFile: string;
}

export class TurboModeRunner {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Executes the full Turbo Mode pipeline:
   * 1. Validates Gemini API Key
   * 2. Crawls workspace context & hardware pins
   * 3. Synthesizes documentation with Gemini 2.5 Flash
   * 4. Updates README.md (with README.backup.md safety)
   * 5. Prompts for authenticated GitHub commit & push
   */
  public async run(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('RepoPilot Turbo Mode: Please open a project workspace folder first.');
      return;
    }

    const rootPath = workspaceFolder.uri.fsPath;

    // 1. Ensure Gemini API key is configured
    const apiKey = await GeminiClient.getOrPromptApiKey(this.context);
    if (!apiKey) {
      vscode.window.showWarningMessage('RepoPilot Turbo Mode: Cancelled. A Gemini API Key is required to run Turbo Mode.');
      return;
    }

    // 2. Run with Progress Notification
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'RepoPilot Turbo Mode',
        cancellable: false
      },
      async (progress) => {
        // Step 1: Scan workspace
        progress.report({ increment: 15, message: 'Auditing workspace files & hardware pins...' });
        const snapshot = await this.crawlWorkspaceContext(rootPath);

        // Step 2: Synthesize documentation via Gemini 2.5 Flash
        progress.report({ increment: 45, message: 'Synthesizing architecture diagram & specs with Gemini 2.5 Flash...' });
        let generatedMarkdown: string;
        try {
          generatedMarkdown = await GeminiClient.generateDocumentation(apiKey, snapshot);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`RepoPilot Turbo Mode Error: ${msg}`);
          return;
        }

        // Step 3: Backup existing README and write new one
        progress.report({ increment: 25, message: 'Writing README.md & backing up original...' });
        const readmeUri = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
        const backupUri = vscode.Uri.joinPath(workspaceFolder.uri, 'README.backup.md');

        try {
          // Check if README.md exists and back it up
          await vscode.workspace.fs.stat(readmeUri);
          await vscode.workspace.fs.copy(readmeUri, backupUri, { overwrite: true });
        } catch {
          // No previous README to backup
        }

        // Write the new README.md
        await vscode.workspace.fs.writeFile(readmeUri, Buffer.from(generatedMarkdown, 'utf8'));

        // Open README side-by-side
        const doc = await vscode.workspace.openTextDocument(readmeUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        progress.report({ increment: 15, message: 'Workspace audit complete!' });
      }
    );

    // 3. Human-in-the-loop GitHub Commit & Push Modal
    const selection = await vscode.window.showInformationMessage(
      'RepoPilot Turbo Mode: README.md generated with Mermaid architecture & technical specs. Ready to commit and push?',
      { modal: true },
      'Commit & Push to GitHub',
      'Keep Local Only'
    );

    if (selection === 'Commit & Push to GitHub') {
      await this.commitAndPushToGitHub(rootPath);
    } else {
      vscode.window.showInformationMessage('RepoPilot: README.md updated locally. (Local-only mode kept)');
    }
  }

  /**
   * Crawls workspace context, directory tree, dependencies, key files, and hardware pin definitions.
   */
  public async crawlWorkspaceContext(rootPath: string): Promise<string> {
    const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'out', '__pycache__', '.venv', 'venv', '.vscode-test', 'proofs']);
    const allowedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.ino', '.cpp', '.c', '.h', '.hpp', '.md', '.yaml', '.yml']);

    // 1. Directory tree and candidate file list
    const allFiles: string[] = [];
    const dirTreeLines: string[] = [];

    const walk = (currentDir: string, depth = 0, maxDepth = 4) => {
      if (depth > maxDepth) {
        return;
      }
      try {
        const fs = require('fs');
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
        // Ignore read errors
      }
    };

    walk(rootPath);

    // 2. Detect Hardware Pin Definitions
    const hardwarePins = this.detectHardwarePins(allFiles, rootPath);

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

    // 4. Select up to 15 key source files
    const prioritizedFiles = this.prioritizeKeyFiles(allFiles, rootPath);
    const fileSnapshots: string[] = [];

    const fs = require('fs');
    for (const file of prioritizedFiles.slice(0, 15)) {
      try {
        const relPath = path.relative(rootPath, file);
        let content = fs.readFileSync(file, 'utf8');
        if (content.length > 4000) {
          content = content.slice(0, 4000) + '\n\n... [Truncated for token efficiency by RepoPilot] ...';
        }
        fileSnapshots.push(`### File: ${relPath}\n\`\`\`\n${content}\n\`\`\``);
      } catch {
        // Skip unreadable files
      }
    }

    let summary = `# Workspace Snapshot\nRoot: ${rootPath}\nGitDiagram URL: ${gitDiagramUrl}\n\n`;
    summary += `## Directory Structure\n\`\`\`\n${dirTreeLines.slice(0, 80).join('\n')}\n\`\`\`\n\n`;

    if (routeResults.backendEndpoints.length > 0) {
      summary += `## Detected Backend API Routes (${routeResults.backendEndpoints.length})\n`;
      routeResults.backendEndpoints.forEach((r) => {
        summary += `- **${r.method || 'GET'}** \`${r.rawRoute}\` (defined in \`${r.file}\`)\n`;
      });
      summary += '\n';
    }

    if (hardwarePins.length > 0) {
      summary += `## Detected Hardware Pin Definitions (${hardwarePins.length})\n`;
      hardwarePins.forEach((p) => {
        summary += `- **Pin ${p.pin}** (\`${p.name}\`): ${p.direction || 'GPIO'} [defined in \`${p.sourceFile}\`]\n`;
      });
      summary += '\n';
    }

    summary += `## Key Source Files Content (${fileSnapshots.length} files)\n\n`;
    summary += fileSnapshots.join('\n\n');

    return summary;
  }

  /**
   * Scans code files for hardware / microcontroller pin definitions (Arduino, ESP32, Raspberry Pi, MicroPython).
   */
  public detectHardwarePins(files: string[], rootPath: string): HardwarePinMapping[] {
    const pins: HardwarePinMapping[] = [];
    const fs = require('fs');

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
          // C/C++/Arduino: #define LED_PIN 13 or #define DHTPIN 4
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

          // MicroPython: Pin(14, Pin.OUT) or Pin(4, Pin.IN)
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
        // Skip unreadable files
      }
    }

    return pins;
  }

  private prioritizeKeyFiles(files: string[], rootPath: string): string[] {
    return files.sort((a, b) => {
      const aRel = path.relative(rootPath, a).toLowerCase();
      const bRel = path.relative(rootPath, b).toLowerCase();

      const getScore = (p: string) => {
        let score = 0;
        if (p.includes('package.json') || p.includes('requirements.txt')) {
          score += 50;
        }
        if (p.includes('app.py') || p.includes('main.py') || p.includes('server.js') || p.includes('index.ts') || p.includes('extension.ts')) {
          score += 40;
        }
        if (p.includes('route') || p.includes('controller') || p.includes('api')) {
          score += 30;
        }
        if (p.includes('.ino') || p.includes('hardware') || p.includes('pinout') || p.includes('main.cpp')) {
          score += 30;
        }
        if (p.includes('readme.md')) {
          score += 20;
        }
        return score;
      };

      return getScore(bRel) - getScore(aRel);
    });
  }

  /**
   * Commits and pushes README.md to GitHub using VS Code Git extension or authenticated session.
   */
  public async commitAndPushToGitHub(rootPath: string): Promise<void> {
    // 1. Request GitHub Authentication Session
    let session: vscode.AuthenticationSession | undefined;
    try {
      session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
    } catch {
      vscode.window.showWarningMessage('RepoPilot: GitHub authentication was cancelled. Changes were saved locally.');
      return;
    }

    if (!session) {
      vscode.window.showWarningMessage('RepoPilot: GitHub session could not be established. Changes were saved locally.');
      return;
    }

    // 2. Try VS Code built-in Git extension
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    let repository: GitRepository | undefined;

    if (gitExtension) {
      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }
      const git = gitExtension.exports.getAPI(1);
      repository = git.repositories.find((r) => r.rootUri.fsPath === rootPath) || git.repositories[0];
    }

    // Check if git repository exists
    try {
      await execAsync('git status --porcelain', { cwd: rootPath });
    } catch {
      vscode.window.showErrorMessage('RepoPilot: Workspace is not a Git repository. Run "git init" to initialize version control.');
      return;
    }

    // Check remote origin
    let hasRemoteOrigin = false;
    let remoteUrl = '';
    try {
      const { stdout } = await execAsync('git remote -v', { cwd: rootPath });
      hasRemoteOrigin = stdout.includes('origin');
      const originMatch = stdout.match(/origin\s+([^\s]+)\s+\(push\)/);
      if (originMatch) {
        remoteUrl = originMatch[1];
      }
    } catch {
      // Ignore
    }

    if (!hasRemoteOrigin) {
      // Commit locally and inform user
      try {
        await execAsync('git add README.md', { cwd: rootPath });
        await execAsync('git commit -m "docs(repopilot): generate architecture diagram and technical specs"', { cwd: rootPath });
        vscode.window.showWarningMessage(
          'RepoPilot: README.md committed locally! However, no remote "origin" is configured, so push was skipped.'
        );
      } catch (commitErr: unknown) {
        const msg = commitErr instanceof Error ? commitErr.message : String(commitErr);
        vscode.window.showWarningMessage(`RepoPilot: Local commit note: ${msg}`);
      }
      return;
    }

    // 3. Stage, Commit, and Push
    const commitMessage = 'docs(repopilot): generate architecture diagram and technical specs';

    try {
      if (repository) {
        await repository.add([path.join(rootPath, 'README.md')]);
        await repository.commit(commitMessage);
        await repository.push();
      } else {
        await execAsync('git add README.md', { cwd: rootPath });
        await execAsync(`git commit -m "${commitMessage}"`, { cwd: rootPath });

        // Authenticated push using session token if remote is HTTPS GitHub
        const branchResult = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: rootPath });
        const currentBranch = branchResult.stdout.trim() || 'main';

        if (remoteUrl.startsWith('https://github.com/')) {
          const authUrl = remoteUrl.replace('https://github.com/', `https://x-access-token:${session.accessToken}@github.com/`);
          await execAsync(`git push ${authUrl} ${currentBranch}`, { cwd: rootPath });
        } else {
          await execAsync(`git push origin ${currentBranch}`, { cwd: rootPath });
        }
      }

      vscode.window.showInformationMessage('🚀 RepoPilot: README.md committed and pushed to GitHub successfully!');
    } catch (pushErr: unknown) {
      const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
      vscode.window.showErrorMessage(`RepoPilot GitHub Push Error: ${msg}. Changes remain committed locally.`);
    }
  }
}
