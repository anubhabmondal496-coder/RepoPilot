import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

/**
 * Minimal interfaces matching the VS Code Git extension v1 API.
 */
interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: GitRepository[];
}

interface GitChange {
  uri: vscode.Uri;
  status: number;
}

interface GitRepository {
  rootUri: vscode.Uri;
  inputBox: {
    value: string;
  };
  state: {
    indexChanges: GitChange[];
    workingTreeChanges: GitChange[];
    HEAD?: { name?: string; commit?: string };
  };
  diff(cached?: boolean): Promise<string>;
}

export class CommitDrafter {
  /**
   * Registers the `repopilot.draftCommit` command.
   */
  public register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('repopilot.draftCommit', async () => {
      await this.draftSemanticCommit();
    });
  }

  /**
   * Analyzes current git changes and populates the Source Control input box.
   */
  public async draftSemanticCommit(): Promise<void> {
    const gitRepo = await this.getActiveGitRepository();

    let stagedFiles: string[] = [];
    let unstagedFiles: string[] = [];
    let diffText = '';
    const rootPath = gitRepo?.rootUri.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (gitRepo) {
      stagedFiles = gitRepo.state.indexChanges.map((c) => path.basename(c.uri.fsPath));
      unstagedFiles = gitRepo.state.workingTreeChanges.map((c) => path.basename(c.uri.fsPath));

      try {
        // Try getting diff from Git API
        if (stagedFiles.length > 0) {
          diffText = await gitRepo.diff(true);
        } else {
          diffText = await gitRepo.diff(false);
        }
      } catch {
        // If gitRepo.diff fails, fallback to CLI
      }
    }

    // Fallback to git CLI if gitRepo or diff was empty
    if ((!stagedFiles.length && !unstagedFiles.length) || !diffText) {
      if (rootPath) {
        const cliResult = await this.inspectGitViaCli(rootPath);
        if (cliResult.staged.length > 0) {
          stagedFiles = cliResult.staged;
          diffText = cliResult.stagedDiff;
        } else {
          unstagedFiles = cliResult.unstaged;
          diffText = cliResult.workingDiff;
        }
      }
    }

    const targetFiles = stagedFiles.length > 0 ? stagedFiles : unstagedFiles;

    if (targetFiles.length === 0 && !diffText.trim()) {
      vscode.window.showInformationMessage('RepoPilot: No git changes detected to draft a commit.');
      return;
    }

    const message = this.synthesizeConventionalCommit(targetFiles, diffText);

    // Populate the VS Code Source Control input box
    if (gitRepo) {
      gitRepo.inputBox.value = message;
    }

    // Switch focus to the SCM viewlet so the user sees the drafted message
    await vscode.commands.executeCommand('workbench.view.scm');

    vscode.window.showInformationMessage(`RepoPilot: Drafted commit message: "${message}"`);
  }

  /**
   * Retrieves the first active repository from the VS Code Git extension.
   */
  private async getActiveGitRepository(): Promise<GitRepository | undefined> {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension) {
      return undefined;
    }

    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }

    const git = gitExtension.exports.getAPI(1);
    return git.repositories[0];
  }

  /**
   * CLI fallback to read status and diff using child_process.
   */
  private async inspectGitViaCli(cwd: string): Promise<{
    staged: string[];
    unstaged: string[];
    stagedDiff: string;
    workingDiff: string;
  }> {
    try {
      const { stdout: statusOut } = await execFileAsync('git', ['status', '--porcelain'], { cwd });
      const staged: string[] = [];
      const unstaged: string[] = [];

      const lines = statusOut.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const indexStatus = line[0];
        const workStatus = line[1];
        const filePath = line.substring(3).trim();
        const base = path.basename(filePath);

        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(base);
        }
        if (workStatus !== ' ' || indexStatus === '?') {
          unstaged.push(base);
        }
      }

      let stagedDiff = '';
      let workingDiff = '';
      try {
        const { stdout: sDiff } = await execFileAsync('git', ['diff', '--cached'], { cwd });
        stagedDiff = sDiff;
      } catch { /* empty */ }

      try {
        const { stdout: wDiff } = await execFileAsync('git', ['diff'], { cwd });
        workingDiff = wDiff;
      } catch { /* empty */ }

      return { staged, unstaged, stagedDiff, workingDiff };
    } catch {
      return { staged: [], unstaged: [], stagedDiff: '', workingDiff: '' };
    }
  }

  /**
   * Synthesizes a clean Conventional Commit message based on file names and diff content.
   */
  public synthesizeConventionalCommit(changedFiles: string[], diffText: string): string {
    const lowerFiles = changedFiles.map((f) => f.toLowerCase());
    const lowerDiff = diffText.toLowerCase();

    // 1. Dependency updates (requirements.txt, package.json, etc.)
    const hasDeps = lowerFiles.some((f) =>
      f === 'requirements.txt' || f === 'package.json' || f === 'package-lock.json' || f === 'pnpm-lock.yaml'
    );
    if (hasDeps && changedFiles.length <= 3) {
      if (lowerDiff.includes('+fastapi') || lowerDiff.includes('+httpx') || lowerDiff.includes('+"')) {
        return 'fix(deps): update project dependencies in requirements and manifests';
      }
      return 'chore(deps): synchronize package requirements and lockfile';
    }

    // 2. Documentation updates
    const hasOnlyDocs = lowerFiles.every((f) => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.png'));
    if (hasOnlyDocs) {
      if (lowerFiles.includes('readme.md')) {
        return 'docs(readme): update system architecture and usage documentation';
      }
      return 'docs: update repository documentation and assets';
    }

    // 3. API Route or Backend changes
    const hasApiChanges = lowerFiles.some((f) =>
      f.includes('api') || f.includes('route') || f.includes('backend') || f.endsWith('.py')
    ) || lowerDiff.includes('@app.get') || lowerDiff.includes('@app.post') || lowerDiff.includes('/api/');

    if (hasApiChanges) {
      // Check for specific API routes added in the diff
      const routeMatch = diffText.match(/\+(?:@app|\.get|\.post)\s*\(\s*["'](\/api\/[^"']+)["']/);
      if (routeMatch) {
        return `feat(api): implement ${routeMatch[1]} endpoint`;
      }
      return 'feat(api): update backend routes and service handlers';
    }

    // 4. Frontend / UI changes
    const hasFrontendChanges = lowerFiles.some((f) =>
      f.endsWith('.tsx') || f.endsWith('.jsx') || f.includes('frontend') || f.includes('ui')
    );
    if (hasFrontendChanges) {
      return 'feat(frontend): update client components and API integration';
    }

    // 5. Test additions
    const hasTests = lowerFiles.some((f) =>
      f.includes('test') || f.includes('spec') || f.includes('fixture')
    );
    if (hasTests) {
      return 'test: add test fixtures and integration specifications';
    }

    // 6. Build / Configuration
    const hasConfig = lowerFiles.some((f) =>
      f.startsWith('.') || f.includes('tsconfig') || f.includes('esbuild') || f.includes('config')
    );
    if (hasConfig) {
      return 'chore(config): configure extension build and workspace settings';
    }

    // Default fallback based on changed count
    if (changedFiles.length === 1) {
      return `feat: update ${changedFiles[0]}`;
    }

    return `feat: update ${changedFiles.slice(0, 2).join(', ')} and related modules`;
  }
}
