import { execSync } from 'child_process';
import * as path from 'path';

export interface GitConflictReport {
  hasConflicts: boolean;
  conflictedFiles: string[];
  message: string;
}

export interface TurboPushResult {
  success: boolean;
  haltedForConflict: boolean;
  message: string;
  pushedCommit?: string;
  conflictedFiles?: string[];
}

export class GitService {
  private cwd: string;

  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Checks if current working tree has active merge conflicts.
   */
  public detectMergeConflicts(): GitConflictReport {
    try {
      const statusOutput = execSync('git status --porcelain', { cwd: this.cwd, encoding: 'utf8' });
      const conflictedFiles: string[] = [];

      const lines = statusOutput.split('\n');
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        const statusCode = line.substring(0, 2);
        // Git porcelain conflict codes: UU, AA, DD, AU, UD, UA, DU
        if (['UU', 'AA', 'DD', 'AU', 'UD', 'UA', 'DU'].includes(statusCode)) {
          conflictedFiles.push(line.substring(3).trim());
        }
      }

      // Also check for conflict markers in tracked files
      let diffCheckHasConflicts = false;
      try {
        execSync('git diff --check', { cwd: this.cwd, stdio: 'pipe' });
      } catch (err: unknown) {
        const errorOutput = typeof err === 'object' && err !== null && 'stdout' in err
          ? String((err as { stdout?: string }).stdout)
          : '';
        if (errorOutput.includes('conflict') || errorOutput.includes('leftover conflict marker')) {
          diffCheckHasConflicts = true;
        }
      }

      const hasConflicts = conflictedFiles.length > 0 || diffCheckHasConflicts;
      return {
        hasConflicts,
        conflictedFiles,
        message: hasConflicts
          ? `Detected ${conflictedFiles.length || 'active'} merge conflict(s).`
          : 'Clean working tree, no merge conflicts detected.'
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        hasConflicts: false,
        conflictedFiles: [],
        message: `Git status check error: ${msg}`
      };
    }
  }

  /**
   * Checks if remote branch has diverged before pushing.
   */
  public async checkRemoteDivergence(): Promise<{ diverged: boolean; remoteConflictsPossible: boolean }> {
    try {
      // 1. Fetch remote changes without auto-merging
      execSync('git fetch --dry-run', { cwd: this.cwd, stdio: 'pipe' });
      
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.cwd, encoding: 'utf8' }).trim();
      
      // Check upstream tracking branch
      let upstream = '';
      try {
        upstream = execSync('git rev-parse --abbrev-ref @{u}', { cwd: this.cwd, encoding: 'utf8' }).trim();
      } catch {
        // No upstream configured yet
        return { diverged: false, remoteConflictsPossible: false };
      }

      // Check commit counts: behind / ahead
      const countOutput = execSync(`git rev-list --left-right --count ${upstream}...${currentBranch}`, {
        cwd: this.cwd,
        encoding: 'utf8'
      }).trim();

      const [behind, ahead] = countOutput.split(/\s+/).map(Number);
      if (behind > 0 && ahead > 0) {
        return { diverged: true, remoteConflictsPossible: true };
      }

      return { diverged: false, remoteConflictsPossible: false };
    } catch {
      return { diverged: false, remoteConflictsPossible: false };
    }
  }

  /**
   * Executes the Turbo Mode automated pipeline:
   * 1. Inspects conflicts -> HALTS if conflicts exist!
   * 2. Checks divergence -> HALTS if remote diverged to prevent destructive push!
   * 3. Stages changes
   * 4. Commits with semantic message
   * 5. Pushes to origin
   */
  public executeTurboPush(): TurboPushResult {
    // 1. Check for active merge conflicts
    const conflictCheck = this.detectMergeConflicts();
    if (conflictCheck.hasConflicts) {
      return {
        success: false,
        haltedForConflict: true,
        message: `Turbo Mode halted: Merge conflicts detected in: ${conflictCheck.conflictedFiles.join(', ')}`,
        conflictedFiles: conflictCheck.conflictedFiles
      };
    }

    try {
      // 2. Inspect working tree
      const status = execSync('git status --porcelain', { cwd: this.cwd, encoding: 'utf8' }).trim();
      let committed = false;

      if (status) {
        // Stage all changes
        execSync('git add -A', { cwd: this.cwd });

        // Generate semantic commit message
        const commitMsg = this.generateSemanticCommitMessage(status);
        execSync(`git commit -m "${commitMsg}"`, { cwd: this.cwd });
        committed = true;
      }

      // 3. Attempt push to current upstream
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.cwd, encoding: 'utf8' }).trim();
      
      let pushOutput = '';
      try {
        pushOutput = execSync(`git push origin ${currentBranch}`, { cwd: this.cwd, encoding: 'utf8' });
      } catch (pushErr: unknown) {
        const errorMsg = pushErr instanceof Error ? pushErr.message : String(pushErr);
        if (errorMsg.includes('rejected') || errorMsg.includes('non-fast-forward') || errorMsg.includes('conflict')) {
          return {
            success: false,
            haltedForConflict: true,
            message: `Turbo Mode push aborted: Remote branch '${currentBranch}' contains conflicting commits. Please run 'git pull' and resolve conflicts.`
          };
        }
        throw pushErr;
      }

      const latestCommit = execSync('git rev-parse --short HEAD', { cwd: this.cwd, encoding: 'utf8' }).trim();

      return {
        success: true,
        haltedForConflict: false,
        message: committed
          ? `Changes committed (${latestCommit}) and pushed cleanly to origin/${currentBranch}.`
          : `Remote origin/${currentBranch} is already up to date (${latestCommit}).`,
        pushedCommit: latestCommit
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        haltedForConflict: false,
        message: `Turbo push failed: ${msg}`
      };
    }
  }

  private generateSemanticCommitMessage(status: string): string {
    if (status.includes('requirements.txt') || status.includes('package.json')) {
      return 'fix(deps): synchronize project dependencies';
    }
    if (status.includes('.py') || status.includes('/api/')) {
      return 'feat(api): autonomous update of endpoints and service handlers';
    }
    if (status.includes('.md')) {
      return 'docs: update project documentation and system overview';
    }
    return 'chore: autonomous repository update via RepoPilot Turbo Mode';
  }
}
