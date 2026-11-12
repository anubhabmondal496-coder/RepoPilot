import * as vscode from 'vscode';
import { HealthMonitor } from './watchers/healthMonitor';
import { CommitDrafter } from './git/commitDrafter';
import { GeneratorService } from './services/generatorService';
import { ContractChecker } from './services/contractChecker';
import { SecurityScanner } from './services/securityScanner';
import { DepFixer } from './services/depFixer';
import { GitService } from './services/gitService';

let healthMonitorInstance: HealthMonitor | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

function getConfigFileUri(): vscode.Uri | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  return root ? vscode.Uri.joinPath(root, '.repopilot.json') : undefined;
}

async function readCurrentMode(): Promise<'turbo' | 'preview'> {
  const fileUri = getConfigFileUri();
  if (!fileUri) {
    return 'preview';
  }
  try {
    const data = await vscode.workspace.fs.readFile(fileUri);
    const config = JSON.parse(Buffer.from(data).toString('utf8'));
    return config.mode === 'turbo' ? 'turbo' : 'preview';
  } catch {
    return 'preview';
  }
}

async function setMode(mode: 'turbo' | 'preview'): Promise<void> {
  const fileUri = getConfigFileUri();
  if (!fileUri) {
    return;
  }
  let config: Record<string, unknown> = { customCommands: {} };
  try {
    const data = await vscode.workspace.fs.readFile(fileUri);
    config = JSON.parse(Buffer.from(data).toString('utf8'));
  } catch {
    // Fallback on missing file
  }
  config.mode = mode;
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(config, null, 2), 'utf8'));
}

async function updateStatusBar(): Promise<void> {
  if (!statusBarItem) {
    return;
  }
  const mode = await readCurrentMode();
  if (mode === 'turbo') {
    statusBarItem.text = '$(zap) RepoPilot: Turbo';
    statusBarItem.tooltip = 'RepoPilot Hybrid Engine: Turbo Mode active (Click to switch to Preview Mode)';
    statusBarItem.command = 'repopilot.enablePreviewMode';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.text = '$(eye) RepoPilot: Preview';
    statusBarItem.tooltip = 'RepoPilot Hybrid Engine: Preview Mode active (Click to switch to Turbo Mode)';
    statusBarItem.command = 'repopilot.enableTurboMode';
    statusBarItem.backgroundColor = undefined;
  }
  statusBarItem.show();
}

/**
 * Extension activation entrypoint for RepoPilot.
 */
export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('RepoPilot');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine('[RepoPilot] Activating Hybrid Engine and Background Intelligence...');

  const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  // 1. Initialize Passive Health Monitor (Dependency Tracker & API Contract Verifier)
  healthMonitorInstance = new HealthMonitor();
  healthMonitorInstance.activate(context);
  context.subscriptions.push({
    dispose: () => {
      healthMonitorInstance?.dispose();
    }
  });

  // 2. Initialize Semantic Git Commit Drafter
  const commitDrafter = new CommitDrafter();
  context.subscriptions.push(commitDrafter.register(context));

  // 3. Status Bar Integration for Hybrid Engine Modes (Preview vs Turbo)
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  // Watch for .repopilot.json modifications
  const configWatcher = vscode.workspace.createFileSystemWatcher('**/.repopilot.json');
  context.subscriptions.push(configWatcher);
  configWatcher.onDidChange(() => updateStatusBar(), null, context.subscriptions);
  configWatcher.onDidCreate(() => updateStatusBar(), null, context.subscriptions);
  configWatcher.onDidDelete(() => updateStatusBar(), null, context.subscriptions);

  // 4. Register Mode Switching Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.enableTurboMode', async () => {
      await setMode('turbo');
      await updateStatusBar();
      const gitService = new GitService(rootPath);
      const result = gitService.executeTurboPush();

      if (result.haltedForConflict) {
        vscode.window.showErrorMessage(`⚠️ RepoPilot Turbo Push Halted: ${result.message}`);
      } else if (result.success) {
        vscode.window.showInformationMessage(`⚡ RepoPilot Turbo Mode: ${result.message}`);
      } else {
        vscode.window.showWarningMessage(`⚡ RepoPilot Turbo Mode: ${result.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.enablePreviewMode', async () => {
      await setMode('preview');
      await updateStatusBar();
      const generator = new GeneratorService(rootPath);
      const overview = generator.generateArchitectureOverview();
      outputChannel.appendLine(overview);
      outputChannel.show();
      vscode.window.showInformationMessage('🔍 RepoPilot: Preview Mode enabled (Safe architecture inspection).');
    })
  );

  // 5. Register Generation Commands (Pitch & Judge Q&A)
  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.generateQnA', async () => {
      const generator = new GeneratorService(rootPath);
      const { qnaPath } = generator.generateQnASession();
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(qnaPath));
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`🎯 RepoPilot: Judge Q&A Guide generated in ${qnaPath}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.generatePitch', async () => {
      const generator = new GeneratorService(rootPath);
      const { scriptPath } = generator.generatePitchScript();
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(scriptPath));
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`🎤 RepoPilot: 3-5 Minute Pitch Script generated in ${scriptPath}`);
    })
  );

  // 6. Register Diagnostic & Security Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.checkStatus', async () => {
      const checker = new ContractChecker(rootPath);
      const report = checker.checkSystemStatus();
      if (report.isApiContractHealthy && report.areApiKeysSafe) {
        vscode.window.showInformationMessage(report.summary);
      } else {
        vscode.window.showWarningMessage(report.summary);
      }
      outputChannel.appendLine(`[API Status Check] ${JSON.stringify(report, null, 2)}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.checkHealth', async () => {
      const scanner = new SecurityScanner(rootPath);
      const report = scanner.runFullSecurityAudit();
      if (report.criticalCount === 0) {
        vscode.window.showInformationMessage(report.summaryMessage);
      } else {
        vscode.window.showErrorMessage(report.summaryMessage);
      }
      outputChannel.appendLine(`[Security Audit] ${JSON.stringify(report, null, 2)}`);
      outputChannel.show();
    })
  );

  // 7. Interactive Judge and Dependency Fixer Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.interactiveJudge', () => {
      const terminal = vscode.window.createTerminal('RepoPilot Judge Simulator');
      terminal.show();
      terminal.sendText('node bin/repopilot.js --interactive-judge');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.fixDeps', async () => {
      const fixer = new DepFixer(rootPath);
      const result = fixer.fixMissingDependencies();
      if (result.added.length > 0) {
        vscode.window.showInformationMessage(
          `✔ RepoPilot: Appended ${result.added.join(', ')} to requirements.txt`
        );
      } else {
        vscode.window.showInformationMessage('✔ RepoPilot: All imports already listed in requirements.txt');
      }
    })
  );

  // 8. Placeholders
  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.turboMode', () => {
      vscode.commands.executeCommand('repopilot.enableTurboMode');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.sprintLogistics', () => {
      vscode.commands.executeCommand('repopilot.generatePitch');
    })
  );

  outputChannel.appendLine('[RepoPilot] Engine initialized successfully.');
}

export function deactivate(): void {
  healthMonitorInstance?.dispose();
  healthMonitorInstance = undefined;
  statusBarItem?.dispose();
  statusBarItem = undefined;
}
