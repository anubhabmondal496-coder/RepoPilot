import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GeminiClient } from '../ai/geminiClient';
import { runTurboCore, TurboEngineResult } from '../services/turboEngine';

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

export class TurboModeRunner {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Executes the full Turbo Mode pipeline inside VS Code.
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

    let result: TurboEngineResult | undefined;

    // 2. Run with Progress Notification
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'RepoPilot Turbo Mode',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 20, message: 'Auditing workspace files, routes & hardware pins...' });
        
        progress.report({ increment: 50, message: 'Synthesizing architecture & specs with Gemini AI...' });
        try {
          result = await runTurboCore(rootPath, apiKey);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`RepoPilot Turbo Mode Error: ${msg}`);
          return;
        }

        progress.report({ increment: 25, message: 'Updating README.md with live GitDiagram hierarchy...' });

        // Open README side-by-side
        const readmeUri = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
        const doc = await vscode.workspace.openTextDocument(readmeUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        progress.report({ increment: 5, message: 'Gemini synthesis complete!' });
      }
    );

    if (!result) {
      return;
    }

    // 3. Human-in-the-loop GitHub Commit & Push Modal showing Gemini's modifications
    const selection = await vscode.window.showInformationMessage(
      `⚡ RepoPilot Turbo Mode: Gemini synthesized technical documentation and updated README.md with live GitDiagram hierarchy!\n\nReady to commit and push to GitHub?`,
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
   * Commits and pushes README.md to GitHub using VS Code Git extension or authenticated session.
   */
  public async commitAndPushToGitHub(rootPath: string): Promise<void> {
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

    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    let repository: GitRepository | undefined;

    if (gitExtension) {
      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }
      const git = gitExtension.exports.getAPI(1);
      repository = git.repositories.find((r) => r.rootUri.fsPath === rootPath) || git.repositories[0];
    }

    try {
      await execAsync('git status --porcelain', { cwd: rootPath });
    } catch {
      vscode.window.showErrorMessage('RepoPilot: Workspace is not a Git repository. Run "git init" to initialize version control.');
      return;
    }

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

    const commitMessage = 'docs(repopilot): generate architecture diagram and technical specs';

    try {
      if (repository) {
        await repository.add([path.join(rootPath, 'README.md')]);
        await repository.commit(commitMessage);
        await repository.push();
      } else {
        await execAsync('git add README.md', { cwd: rootPath });
        await execAsync(`git commit -m "${commitMessage}"`, { cwd: rootPath });

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
