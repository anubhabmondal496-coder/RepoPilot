import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SecurityFinding {
  severity: Severity;
  category: 'LEAKED_KEY' | 'ENV_EXPOSURE' | 'DANGEROUS_CALL' | 'INSECURE_CORS' | 'RAW_SQL';
  file: string;
  line: number;
  snippet: string;
  recommendation: string;
}

export interface SecurityReport {
  timestamp: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  findings: SecurityFinding[];
  isEnvSafe: boolean;
  summaryMessage: string;
}

export class SecurityScanner {
  private cwd: string;

  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Scans workspace for exposed API keys and security vulnerabilities.
   */
  public runFullSecurityAudit(): SecurityReport {
    const findings: SecurityFinding[] = [];

    // 1. Audit .env safety and git tracking
    const envFindings = this.checkEnvExposure();
    findings.push(...envFindings);

    // 2. Scan project code files for leaked keys and dangerous patterns
    const codeFiles = this.collectSourceFiles(this.cwd);
    for (const filePath of codeFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        this.scanFileContent(filePath, content, findings);
      } catch {
        // Skip unreadable files
      }
    }

    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = findings.filter((f) => f.severity === 'HIGH').length;
    const mediumCount = findings.filter((f) => f.severity === 'MEDIUM').length;

    const isEnvSafe = envFindings.every((f) => f.severity !== 'CRITICAL');

    let summaryMessage = '✅ Workspace security check passed! No high-risk leaks found.';
    if (criticalCount > 0) {
      summaryMessage = `🚨 CRITICAL SECURITY RISK: Found ${criticalCount} leaked key(s) or exposed .env file!`;
    } else if (highCount > 0) {
      summaryMessage = `⚠️ High priority warnings: Found ${highCount} potentially unsafe code pattern(s).`;
    }

    return {
      timestamp: new Date().toISOString(),
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount,
      findings,
      isEnvSafe,
      summaryMessage
    };
  }

  /**
   * Specifically checks if API keys and credentials are safe.
   */
  public checkApiKeysSafety(): { safe: boolean; findings: SecurityFinding[] } {
    const report = this.runFullSecurityAudit();
    const keyFindings = report.findings.filter(
      (f) => f.category === 'LEAKED_KEY' || f.category === 'ENV_EXPOSURE'
    );
    return {
      safe: keyFindings.length === 0,
      findings: keyFindings
    };
  }

  private checkEnvExposure(): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const envPath = path.join(this.cwd, '.env');
    const gitignorePath = path.join(this.cwd, '.gitignore');

    if (fs.existsSync(envPath)) {
      // Check if .env is ignored in .gitignore
      let isIgnored = false;
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        isIgnored = /(?:^|\n)\s*\.env(?:\s|$|\*)/.test(gitignoreContent);
      }

      if (!isIgnored) {
        findings.push({
          severity: 'CRITICAL',
          category: 'ENV_EXPOSURE',
          file: '.gitignore',
          line: 1,
          snippet: '.env is present but NOT excluded in .gitignore',
          recommendation: 'Add `.env` and `.env.*` to `.gitignore` immediately to avoid leaking credentials to GitHub.'
        });
      }

      // Check if .env is already tracked in git history
      try {
        const trackedEnv = execSync('git ls-files .env', { cwd: this.cwd, encoding: 'utf8' }).trim();
        if (trackedEnv) {
          findings.push({
            severity: 'CRITICAL',
            category: 'ENV_EXPOSURE',
            file: '.env',
            line: 1,
            snippet: '.env is currently tracked in Git index',
            recommendation: 'Remove from git index: run `git rm --cached .env` and commit.'
          });
        }
      } catch {
        // Not a git repo or git not available
      }
    }

    return findings;
  }

  private scanFileContent(filePath: string, content: string, findings: SecurityFinding[]): void {
    const relativePath = path.relative(this.cwd, filePath);

    // Skip scanning security scanner rules file itself
    if (relativePath.endsWith('securityScanner.ts')) {
      return;
    }

    const lines = content.split(/\r?\n/);

    // Regex catalog for high-confidence secret matching
    const SECRET_PATTERNS = [
      {
        name: 'OpenAI Secret Key',
        regex: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g,
        severity: 'CRITICAL' as Severity
      },
      {
        name: 'Google Gemini API Key',
        regex: /AIzaSy[A-Za-z0-9_-]{33}/g,
        severity: 'CRITICAL' as Severity
      },
      {
        name: 'GitHub Personal Token',
        regex: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
        severity: 'CRITICAL' as Severity
      },
      {
        name: 'AWS Access Key ID',
        regex: /AKIA[0-9A-Z]{16}/g,
        severity: 'CRITICAL' as Severity
      },
      {
        name: 'Hardcoded Secret Assignment',
        regex: /(?:api_key|apiKey|secret_key|private_key|auth_token)\s*=\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,
        severity: 'HIGH' as Severity
      }
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comment-only lines
      if (/^\s*(?:\/\/|#|\/\*|\*)/.test(line)) {
        continue;
      }

      // 1. Secret patterns
      for (const pattern of SECRET_PATTERNS) {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(line);
        if (match) {
          findings.push({
            severity: pattern.severity,
            category: 'LEAKED_KEY',
            file: relativePath,
            line: i + 1,
            snippet: line.trim().slice(0, 80),
            recommendation: `Detected ${pattern.name}. Replace hardcoded token with process.env or os.environ variable.`
          });
        }
      }

      // 2. Dangerous calls (eval, exec, dangerouslySetInnerHTML)
      if (/\beval\s*\(/.test(line)) {
        findings.push({
          severity: 'HIGH',
          category: 'DANGEROUS_CALL',
          file: relativePath,
          line: i + 1,
          snippet: line.trim().slice(0, 80),
          recommendation: 'Avoid eval() execution as it introduces arbitrary code injection risks.'
        });
      }

      if (/os\.system\s*\(/.test(line)) {
        findings.push({
          severity: 'MEDIUM',
          category: 'DANGEROUS_CALL',
          file: relativePath,
          line: i + 1,
          snippet: line.trim().slice(0, 80),
          recommendation: 'Replace os.system() with subprocess.run(..., check=True) with explicit argument lists.'
        });
      }

      // 3. Insecure Wildcard CORS
      if (/allow_origins\s*=\s*\[\s*["']\*["']\s*\]/i.test(line) || /cors\(\s*\{\s*origin:\s*["']\*["']/i.test(line)) {
        findings.push({
          severity: 'MEDIUM',
          category: 'INSECURE_CORS',
          file: relativePath,
          line: i + 1,
          snippet: line.trim().slice(0, 80),
          recommendation: 'Wildcard CORS (*) detected. Restrict allowed origins to specific production and local domains.'
        });
      }
    }
  }

  private collectSourceFiles(dir: string, fileList: string[] = []): string[] {
    const ignoreDirs = new Set(['node_modules', 'dist', 'out', '.git', '.vscode', '.venv', 'venv', '__pycache__']);
    const allowedExts = new Set(['.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.env']);

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            this.collectSourceFiles(fullPath, fileList);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts.has(ext) || entry.name.startsWith('.env')) {
            fileList.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore read errors
    }
    return fileList;
  }
}
