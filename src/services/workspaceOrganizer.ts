import * as fs from 'fs';
import * as path from 'path';

export interface StructureAuditResult {
  hasStandardDirs: boolean;
  missingDirs: string[];
  createdDirs: string[];
  strayFilesCleaned: string[];
  gitignoreUpdated: boolean;
  missingGitignoreRules: string[];
  structureTree: string;
}

export class WorkspaceOrganizer {
  private workspaceRoot: string;
  private readonly standardDirs = ['src', 'docs', 'assets', 'tests'];
  private readonly requiredGitignorePatterns = [
    'node_modules',
    'dist',
    'out',
    '.env',
    '*.vsix',
    '*.log',
    '__pycache__',
    '.pytest_cache'
  ];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Audits and optionally organizes the workspace file hierarchy.
   */
  public organize(options: { autoFix?: boolean } = {}): StructureAuditResult {
    const autoFix = options.autoFix ?? false;
    const missingDirs: string[] = [];
    const createdDirs: string[] = [];
    const strayFilesCleaned: string[] = [];
    let gitignoreUpdated = false;

    // 1. Audit / Create standard directories
    for (const dir of this.standardDirs) {
      const fullPath = path.join(this.workspaceRoot, dir);
      if (!fs.existsSync(fullPath)) {
        missingDirs.push(dir);
        if (autoFix) {
          fs.mkdirSync(fullPath, { recursive: true });
          createdDirs.push(dir);
        }
      }
    }

    // 2. Audit & Update .gitignore
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }

    const missingRules: string[] = [];
    for (const pattern of this.requiredGitignorePatterns) {
      if (!gitignoreContent.includes(pattern)) {
        missingRules.push(pattern);
      }
    }

    if (missingRules.length > 0 && autoFix) {
      const appendStr = `\n# Added by RepoPilot Workspace Organizer\n${missingRules.join('\n')}\n`;
      fs.appendFileSync(gitignorePath, appendStr, 'utf8');
      gitignoreUpdated = true;
    }

    // 3. Clean up junk temp files (.DS_Store, .tmp) if autoFix
    if (autoFix) {
      const junkNames = ['.DS_Store', 'Thumbs.db'];
      for (const j of junkNames) {
        const jPath = path.join(this.workspaceRoot, j);
        if (fs.existsSync(jPath)) {
          try {
            fs.unlinkSync(jPath);
            strayFilesCleaned.push(j);
          } catch {
            // Ignore
          }
        }
      }
    }

    // 4. Generate visual tree for docs/PROJECT_STRUCTURE.md
    const structureTree = this.renderDirectoryTree(this.workspaceRoot, '', 2);
    if (autoFix) {
      const docsDir = path.join(this.workspaceRoot, 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      const structureDoc = `# 📁 Project File Structure & Module Organization

> **Audited and organized by RepoPilot Workspace Organizer**  
> System Blueprint: [Interactive GitDiagram](https://gitdiagram.com/anubhabmondal496-coder/RepoPilot)

\`\`\`
${structureTree}
\`\`\`

### Directory Standards & Responsibilities
- **\`src/\`**: Core source code, VS Code extension commands, CLI entrypoints, and Agent Brain services.
- **\`docs/\`**: Automatically generated pitch scripts, judge defenses, architecture breakdowns, and submission payloads.
- **\`assets/\`**: Architecture diagrams (\`Diagram.png\`), screenshots, badges, and brand assets.
- **\`tests/\`**: Automated test suites and Playwright E2E submission scripts.
`;
      fs.writeFileSync(path.join(docsDir, 'PROJECT_STRUCTURE.md'), structureDoc, 'utf8');
    }

    return {
      hasStandardDirs: missingDirs.length === 0,
      missingDirs,
      createdDirs,
      strayFilesCleaned,
      gitignoreUpdated,
      missingGitignoreRules: missingRules,
      structureTree
    };
  }

  private renderDirectoryTree(dir: string, prefix: string, maxDepth: number): string {
    if (maxDepth < 0) {
      return '';
    }
    const baseName = path.basename(dir);
    let result = `${prefix}${baseName}/\n`;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      const ignore = new Set(['node_modules', '.git', 'dist', 'out', '__pycache__', '.venv', '.vscode-test']);
      const filtered = items
        .filter((item) => !ignore.has(item.name) && !item.name.startsWith('.git'))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) { return -1; }
          if (!a.isDirectory() && b.isDirectory()) { return 1; }
          return a.name.localeCompare(b.name);
        });

      for (let i = 0; i < filtered.length; i++) {
        const item = filtered[i];
        const isLast = i === filtered.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');

        if (item.isDirectory()) {
          result += this.renderDirectoryTree(path.join(dir, item.name), prefix + pointer, maxDepth - 1);
        } else {
          result += `${prefix}${pointer}${item.name}\n`;
        }
      }
    } catch {
      // Fallback
    }
    return result;
  }
}
