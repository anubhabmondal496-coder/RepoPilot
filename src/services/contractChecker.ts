import * as fs from 'fs';
import * as path from 'path';
import { SecurityScanner } from './securityScanner';

export interface RouteMatchResult {
  connectedRoutes: Array<{ frontendFile: string; backendFile: string; route: string }>;
  unmatchedFrontendCalls: Array<{ file: string; line: number; rawRoute: string; normalized: string }>;
  backendEndpoints: Array<{ file: string; rawRoute: string; normalized: string; method?: string }>;
}

export interface SystemStatusReport {
  timestamp: string;
  backendRoutesCount: number;
  frontendCallsCount: number;
  connectedCount: number;
  orphanedCount: number;
  isApiContractHealthy: boolean;
  areApiKeysSafe: boolean;
  leakedKeysCount: number;
  details: RouteMatchResult;
  summary: string;
}

export class ContractChecker {
  private cwd: string;

  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Scans backend and frontend files to verify connectivity and secret safety.
   */
  public checkSystemStatus(): SystemStatusReport {
    const routeResults = this.analyzeApiContracts();
    
    // Check secret safety
    const securityScanner = new SecurityScanner(this.cwd);
    const keyAudit = securityScanner.checkApiKeysSafety();

    const isApiContractHealthy = routeResults.unmatchedFrontendCalls.length === 0;
    const areApiKeysSafe = keyAudit.safe;

    let summary = '✅ System status healthy: All frontend routes connect to backend, and API keys are securely guarded.';
    if (!isApiContractHealthy && !areApiKeysSafe) {
      summary = `🚨 System Issues: Found ${routeResults.unmatchedFrontendCalls.length} orphaned frontend route(s) AND ${keyAudit.findings.length} exposed secret(s)!`;
    } else if (!isApiContractHealthy) {
      summary = `⚠️ Contract Mismatch: Found ${routeResults.unmatchedFrontendCalls.length} frontend call(s) missing backend endpoints.`;
    } else if (!areApiKeysSafe) {
      summary = `🚨 Secret Warning: Found ${keyAudit.findings.length} exposed API key(s) or insecure .env configuration.`;
    }

    return {
      timestamp: new Date().toISOString(),
      backendRoutesCount: routeResults.backendEndpoints.length,
      frontendCallsCount: routeResults.connectedRoutes.length + routeResults.unmatchedFrontendCalls.length,
      connectedCount: routeResults.connectedRoutes.length,
      orphanedCount: routeResults.unmatchedFrontendCalls.length,
      isApiContractHealthy,
      areApiKeysSafe,
      leakedKeysCount: keyAudit.findings.length,
      details: routeResults,
      summary
    };
  }

  public analyzeApiContracts(): RouteMatchResult {
    const backendEndpoints: RouteMatchResult['backendEndpoints'] = [];
    const backendRouteMap = new Map<string, string>(); // normalized -> filePath

    // 1. Scan for backend routes (.py and backend .ts/.js)
    const allFiles = this.collectFiles(this.cwd);
    for (const file of allFiles) {
      if (file.endsWith('.py')) {
        this.extractPythonRoutes(file, backendEndpoints, backendRouteMap);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        this.extractExpressRoutes(file, backendEndpoints, backendRouteMap);
      }
    }

    const connectedRoutes: RouteMatchResult['connectedRoutes'] = [];
    const unmatchedFrontendCalls: RouteMatchResult['unmatchedFrontendCalls'] = [];

    // 2. Scan frontend calls (.ts, .tsx, .js, .jsx)
    for (const file of allFiles) {
      if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        this.extractFrontendCalls(file, backendRouteMap, connectedRoutes, unmatchedFrontendCalls);
      }
    }

    return {
      connectedRoutes,
      unmatchedFrontendCalls,
      backendEndpoints
    };
  }

  private extractPythonRoutes(
    file: string,
    targetList: RouteMatchResult['backendEndpoints'],
    routeMap: Map<string, string>
  ): void {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const decoratorRegex = /@(?:app|router|api_router|blueprint)\.(get|post|put|delete|patch|route|api_route)\s*\(\s*["']([^"']+)["']/g;
      let match: RegExpExecArray | null;

      while ((match = decoratorRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const rawRoute = match[2];
        const normalized = this.normalizeRoute(rawRoute);

        targetList.push({
          file: path.relative(this.cwd, file),
          rawRoute,
          normalized,
          method
        });
        routeMap.set(normalized, path.relative(this.cwd, file));
      }
    } catch {
      // Ignore
    }
  }

  private extractExpressRoutes(
    file: string,
    targetList: RouteMatchResult['backendEndpoints'],
    routeMap: Map<string, string>
  ): void {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const expressRegex = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
      let match: RegExpExecArray | null;

      while ((match = expressRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const rawRoute = match[2];
        const normalized = this.normalizeRoute(rawRoute);

        targetList.push({
          file: path.relative(this.cwd, file),
          rawRoute,
          normalized,
          method
        });
        routeMap.set(normalized, path.relative(this.cwd, file));
      }
    } catch {
      // Ignore
    }
  }

  private extractFrontendCalls(
    file: string,
    backendRouteMap: Map<string, string>,
    connected: RouteMatchResult['connectedRoutes'],
    unmatched: RouteMatchResult['unmatchedFrontendCalls']
  ): void {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      const apiCallRegex = /(?:fetch|(?:axios|api|client|httpClient)(?:\.(?:get|post|put|delete|patch|request))?)\s*\(\s*[`'"](\/api\/[^`'"]+)[`'"]/g;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        apiCallRegex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = apiCallRegex.exec(line)) !== null) {
          const rawRoute = match[1];
          const normalized = this.normalizeRoute(rawRoute);
          const relFile = path.relative(this.cwd, file);

          if (backendRouteMap.has(normalized)) {
            connected.push({
              frontendFile: relFile,
              backendFile: backendRouteMap.get(normalized)!,
              route: rawRoute
            });
          } else if (backendRouteMap.size > 0) {
            unmatched.push({
              file: relFile,
              line: i + 1,
              rawRoute,
              normalized
            });
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  public normalizeRoute(route: string): string {
    let clean = route.split('?')[0].trim();
    clean = clean.replace(/\$\{[^}]+\}/g, ':param');
    clean = clean.replace(/\{[^}]+\}/g, ':param');
    clean = clean.replace(/:[a-zA-Z0-9_]+/g, ':param');
    clean = clean.replace(/\/+$/, '');
    if (!clean.startsWith('/')) {
      clean = '/' + clean;
    }
    return clean.toLowerCase();
  }

  private collectFiles(dir: string, list: string[] = []): string[] {
    const ignoreDirs = new Set(['node_modules', 'dist', 'out', '.git', '.vscode', '.venv', 'venv']);
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            this.collectFiles(full, list);
          }
        } else if (entry.isFile()) {
          list.push(full);
        }
      }
    } catch {
      // Ignore
    }
    return list;
  }
}
