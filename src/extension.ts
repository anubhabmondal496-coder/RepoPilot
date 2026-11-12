import * as vscode from 'vscode';
import { HealthMonitor } from './watchers/healthMonitor';
import { CommitDrafter } from './git/commitDrafter';

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
    // Fallback on missing or invalid file
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
 * Initializes background health monitoring, Hybrid Engine status bar, and command registry.
 */
export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('RepoPilot');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine('[RepoPilot] Activating Phase 1 Core Extension Engine...');

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

  // Watch for .repopilot.json modifications (e.g. from CLI `repopilot --enable turbo mode`)
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
      vscode.window.showInformationMessage('⚡ RepoPilot: Turbo Mode enabled! (Autonomous Execution active)');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.enablePreviewMode', async () => {
      await setMode('preview');
      await updateStatusBar();
      vscode.window.showInformationMessage('🔍 RepoPilot: Preview Mode enabled! (Interactive Inspection active)');
    })
  );

  // 5. Register Placeholder Commands for Phase 2 & 3
  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.turboMode', () => {
      vscode.window.showInformationMessage(
        'RepoPilot: Turbo Mode is queued for Phase 2 (Autonomous Execution & Auto-Fixing).'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repopilot.sprintLogistics', () => {
      vscode.window.showInformationMessage(
        'RepoPilot: Sprint Logistics is queued for Phase 3 (Submission & Judge Simulator).'
      );
    })
  );

  outputChannel.appendLine('[RepoPilot] Phase 1 Engine initialized successfully.');
}

/**
 * Extension deactivation handler.
 */
export function deactivate(): void {
  healthMonitorInstance?.dispose();
  healthMonitorInstance = undefined;
  statusBarItem?.dispose();
  statusBarItem = undefined;
}
