import * as vscode from 'vscode';
import { HealthMonitor } from './watchers/healthMonitor';
import { CommitDrafter } from './git/commitDrafter';

let healthMonitorInstance: HealthMonitor | undefined;

/**
 * Extension activation entrypoint for RepoPilot.
 * Initializes background health monitoring and registers extension commands.
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

  // 3. Register Placeholder Commands for Phase 2 & 3
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
}
