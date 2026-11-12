import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Standard Python 3.8+ built-in modules to ignore when checking third-party dependencies.
 */
const PYTHON_STDLIB = new Set([
  '__future__', '_thread', 'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat',
  'asyncio', 'asyncore', 'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'binhex',
  'bisect', 'builtins', 'bz2', 'calendar', 'cgi', 'cgitb', 'chunk', 'cmath',
  'cmd', 'code', 'codecs', 'codeop', 'collections', 'colorsys', 'compileall',
  'concurrent', 'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg',
  'cprofile', 'crypt', 'csv', 'ctypes', 'curses', 'dataclasses', 'datetime',
  'dbm', 'decimal', 'difflib', 'dis', 'distutils', 'doctest', 'dummy_threading',
  'email', 'encodings', 'ensurepip', 'enum', 'errno', 'faulthandler', 'fcntl',
  'filecmp', 'fileinput', 'fnmatch', 'formatter', 'fractions', 'ftplib',
  'functools', 'gc', 'genericpath', 'getopt', 'getpass', 'gettext', 'glob', 'grp', 'gzip',
  'hashlib', 'heapq', 'hmac', 'html', 'http', 'imaplib', 'imghdr', 'imp',
  'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json', 'keyword',
  'lib2to3', 'linecache', 'locale', 'logging', 'lzma', 'mailbox', 'mailcap',
  'marshal', 'math', 'mimetypes', 'mmap', 'modulefinder', 'msilib', 'msvcrt',
  'multiprocessing', 'netrc', 'nis', 'nntplib', 'numbers', 'operator', 'optparse',
  'os', 'ossaudiodev', 'parser', 'pathlib', 'pdb', 'pickle', 'pickletools',
  'pipes', 'pkgutil', 'platform', 'plistlib', 'poplib', 'posix', 'posixpath',
  'pprint', 'profile', 'pstats', 'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc',
  'queue', 'quopri', 'random', 're', 'readline', 'reprlib', 'resource', 'rlcompleter',
  'runpy', 'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex', 'shutil',
  'signal', 'site', 'smtpd', 'smtplib', 'sndhdr', 'socket', 'socketserver',
  'spwd', 'sqlite3', 'sre_compile', 'sre_constants', 'sre_parse', 'ssl', 'stat',
  'statistics', 'string', 'stringprep', 'struct', 'subprocess', 'sunau', 'symbol',
  'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny', 'tarfile', 'telnetlib',
  'tempfile', 'termios', 'test', 'textwrap', 'threading', 'time', 'timeit',
  'tkinter', 'token', 'tokenize', 'tomllib', 'trace', 'traceback', 'tracemalloc',
  'tty', 'turtle', 'turtledemo', 'types', 'typing', 'unicodedata', 'unittest',
  'urllib', 'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref', 'webbrowser',
  'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc', 'zipapp', 'zipfile',
  'zipimport', 'zlib', 'zoneinfo'
]);

/**
 * Common mappings from Python import module names to PyPI requirement package names.
 */
const PACKAGE_ALIASES: Record<string, string> = {
  'pil': 'pillow',
  'cv2': 'opencv-python',
  'sklearn': 'scikit-learn',
  'yaml': 'pyyaml',
  'bs4': 'beautifulsoup4',
  'dotenv': 'python-dotenv',
  'jwt': 'pyjwt',
  'serial': 'pyserial',
  'google.protobuf': 'protobuf',
  'google_genai': 'google-genai'
};

export interface RouteDefinition {
  raw: string;
  normalized: string;
  method?: string;
  fileUri: vscode.Uri;
}

export class HealthMonitor {
  private depDiagnosticCollection: vscode.DiagnosticCollection;
  private apiDiagnosticCollection: vscode.DiagnosticCollection;
  private backendRoutes: Map<string, RouteDefinition> = new Map();

  constructor() {
    this.depDiagnosticCollection = vscode.languages.createDiagnosticCollection('repopilot-deps');
    this.apiDiagnosticCollection = vscode.languages.createDiagnosticCollection('repopilot-api');
  }

  /**
   * Initializes background watchers and performs an initial workspace audit.
   */
  public activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(this.depDiagnosticCollection);
    context.subscriptions.push(this.apiDiagnosticCollection);

    // Watchers for Python files and requirements.txt
    const pyWatcher = vscode.workspace.createFileSystemWatcher('**/*.py');
    const reqWatcher = vscode.workspace.createFileSystemWatcher('**/requirements.txt');
    const tsWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx}');

    context.subscriptions.push(pyWatcher);
    context.subscriptions.push(reqWatcher);
    context.subscriptions.push(tsWatcher);

    // Python file changes
    pyWatcher.onDidCreate((uri) => this.checkPythonFile(uri), this, context.subscriptions);
    pyWatcher.onDidChange((uri) => this.checkPythonFile(uri), this, context.subscriptions);
    pyWatcher.onDidDelete((uri) => {
      this.depDiagnosticCollection.delete(uri);
      this.reindexWorkspace();
    }, this, context.subscriptions);

    // requirements.txt changes -> re-evaluate all Python files
    reqWatcher.onDidCreate(() => this.recheckAllPythonFiles(), this, context.subscriptions);
    reqWatcher.onDidChange(() => this.recheckAllPythonFiles(), this, context.subscriptions);
    reqWatcher.onDidDelete(() => this.recheckAllPythonFiles(), this, context.subscriptions);

    // Frontend file changes
    tsWatcher.onDidCreate((uri) => this.checkFrontendFile(uri), this, context.subscriptions);
    tsWatcher.onDidChange((uri) => this.checkFrontendFile(uri), this, context.subscriptions);
    tsWatcher.onDidDelete((uri) => this.apiDiagnosticCollection.delete(uri), this, context.subscriptions);

    // Active editor document events
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId === 'python' || doc.fileName.endsWith('.py')) {
          this.checkPythonDocument(doc);
          this.reindexBackendRoutes();
        } else if (doc.fileName.endsWith('requirements.txt')) {
          this.recheckAllPythonFiles();
        } else if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(doc.languageId) ||
                   /\.(ts|tsx|js|jsx)$/.test(doc.fileName)) {
          this.checkFrontendDocument(doc);
        }
      })
    );

    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc.languageId === 'python' || doc.fileName.endsWith('.py')) {
          this.checkPythonDocument(doc);
        } else if (/\.(ts|tsx|js|jsx)$/.test(doc.fileName)) {
          this.checkFrontendDocument(doc);
        }
      })
    );

    // Initial audit of current workspace
    this.reindexWorkspace();
  }

  /**
   * Reindexes both backend routes and runs diagnostics across workspace files.
   */
  public async reindexWorkspace(): Promise<void> {
    await this.reindexBackendRoutes();
    await this.recheckAllPythonFiles();
    await this.recheckAllFrontendFiles();
  }

  // ---------------------------------------------------------------------------
  // 1. DEPENDENCY TRACKER LOGIC
  // ---------------------------------------------------------------------------

  private async recheckAllPythonFiles(): Promise<void> {
    const pyFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**');
    for (const uri of pyFiles) {
      await this.checkPythonFile(uri);
    }
  }

  private async checkPythonFile(uri: vscode.Uri): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      this.checkPythonDocument(doc);
    } catch {
      // Document might not be accessible
    }
  }

  private async checkPythonDocument(doc: vscode.TextDocument): Promise<void> {
    const text = doc.getText();
    const requirements = await this.findRequirementsForFile(doc.uri);
    const diagnostics: vscode.Diagnostic[] = [];

    // Parse import statements line by line
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments or empty lines
      if (!line || line.startsWith('#')) {
        continue;
      }

      const importedModules = this.extractPythonImports(line);
      for (const mod of importedModules) {
        const topLevel = mod.split('.')[0].toLowerCase();

        // 1. Ignore Python Standard Library
        if (PYTHON_STDLIB.has(topLevel)) {
          continue;
        }

        // 2. Ignore relative imports (start with .)
        if (mod.startsWith('.')) {
          continue;
        }

        // 3. Resolve PyPI package alias or canonical name
        const canonical = PACKAGE_ALIASES[topLevel] || topLevel.replace(/[-_.]/g, '-');

        // 4. Verify against requirements.txt
        const isPresent = requirements.has(canonical) || requirements.has(topLevel);
        if (!isPresent) {
          // Locate character position of import in line
          const colIndex = lines[i].indexOf(mod);
          const startCol = colIndex >= 0 ? colIndex : 0;
          const endCol = colIndex >= 0 ? colIndex + mod.length : lines[i].length;
          const range = new vscode.Range(i, startCol, i, endCol);

          const diagnostic = new vscode.Diagnostic(
            range,
            `RepoPilot: Package '${mod}' is imported but not listed in requirements.txt`,
            vscode.DiagnosticSeverity.Warning
          );
          diagnostic.source = 'RepoPilot (Dependency Tracker)';
          diagnostics.push(diagnostic);
        }
      }
    }

    this.depDiagnosticCollection.set(doc.uri, diagnostics);
  }

  private extractPythonImports(line: string): string[] {
    const results: string[] = [];

    // e.g. "import foo, bar as b"
    const importMatch = line.match(/^import\s+([^#;]+)/);
    if (importMatch) {
      const parts = importMatch[1].split(',');
      for (const p of parts) {
        const trimmed = p.trim().split(/\s+as\s+/)[0].trim();
        if (trimmed) {
          results.push(trimmed);
        }
      }
      return results;
    }

    // e.g. "from foo.bar import baz"
    const fromMatch = line.match(/^from\s+([a-zA-Z0-9_\.]+)\s+import\s+/);
    if (fromMatch) {
      const mod = fromMatch[1].trim();
      if (mod) {
        results.push(mod);
      }
      return results;
    }

    return results;
  }

  /**
   * Finds and parses requirements.txt in the file directory, its parent, or workspace root.
   */
  private async findRequirementsForFile(fileUri: vscode.Uri): Promise<Set<string>> {
    const packages = new Set<string>();

    // Strategy 1: Check in the same directory and parents of the Python file
    let dir = path.dirname(fileUri.fsPath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    const stopDir = workspaceFolder ? path.dirname(workspaceFolder.uri.fsPath) : path.parse(dir).root;

    while (dir && dir !== stopDir) {
      const candidate = path.join(dir, 'requirements.txt');
      try {
        const candidateUri = vscode.Uri.file(candidate);
        const data = await vscode.workspace.fs.readFile(candidateUri);
        this.parseRequirementsContent(Buffer.from(data).toString('utf8'), packages);
        if (packages.size > 0) {
          return packages;
        }
      } catch {
        // Not found in this directory, traverse up
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }

    // Strategy 2: Check any requirements.txt in the workspace
    const reqFiles = await vscode.workspace.findFiles('**/requirements.txt', '**/node_modules/**', 5);
    for (const reqUri of reqFiles) {
      try {
        const data = await vscode.workspace.fs.readFile(reqUri);
        this.parseRequirementsContent(Buffer.from(data).toString('utf8'), packages);
      } catch {
        // Ignore read errors
      }
    }

    return packages;
  }

  private parseRequirementsContent(content: string, targetSet: Set<string>): void {
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('-')) {
        continue;
      }
      // Strip environment markers: "package>=1.0 ; python_version > '3.8'"
      const withoutMarker = line.split(';')[0].trim();
      // Match package name up to version specs (==, >=, <=, ~=, !=, <, >, @, etc.)
      const match = withoutMarker.match(/^([a-zA-Z0-9_\-\.]+)/);
      if (match) {
        const pkg = match[1].toLowerCase().replace(/[-_.]/g, '-');
        targetSet.add(pkg);
        // Also add raw lowercased
        targetSet.add(match[1].toLowerCase());
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. API CONTRACT MISMATCH DETECTOR LOGIC
  // ---------------------------------------------------------------------------

  public async reindexBackendRoutes(): Promise<void> {
    this.backendRoutes.clear();

    // 1. Scan Python files for FastAPI / Flask routes
    const pyFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**');
    for (const uri of pyFiles) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        this.extractBackendRoutesFromText(doc.getText(), uri);
      } catch {
        // Ignore file read error
      }
    }

    // 2. Scan TS / JS files for Express routes
    const jsFiles = await vscode.workspace.findFiles('**/*.{ts,js}', '{**/node_modules/**,**/dist/**,**/out/**}');
    for (const uri of jsFiles) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        this.extractExpressRoutesFromText(doc.getText(), uri);
      } catch {
        // Ignore file read error
      }
    }
  }

  private extractBackendRoutesFromText(text: string, fileUri: vscode.Uri): void {
    // FastAPI/Flask: @app.get("/api/..."), @router.post("/api/..."), @app.route("/api/...")
    const decoratorRegex = /@(?:app|router|api_router|blueprint)\.(?:get|post|put|delete|patch|options|head|route|api_route)\s*\(\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = decoratorRegex.exec(text)) !== null) {
      const rawRoute = match[1];
      const normalized = this.normalizeRoute(rawRoute);
      this.backendRoutes.set(normalized, {
        raw: rawRoute,
        normalized,
        fileUri
      });
    }
  }

  private extractExpressRoutesFromText(text: string, fileUri: vscode.Uri): void {
    // Express: app.get("/api/..."), router.post("/api/...")
    const expressRegex = /(?:app|router)\.(?:get|post|put|delete|patch|options|head)\s*\(\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = expressRegex.exec(text)) !== null) {
      const rawRoute = match[1];
      const normalized = this.normalizeRoute(rawRoute);
      this.backendRoutes.set(normalized, {
        raw: rawRoute,
        normalized,
        fileUri
      });
    }
  }

  private async recheckAllFrontendFiles(): Promise<void> {
    const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', '{**/node_modules/**,**/dist/**,**/out/**}');
    for (const uri of files) {
      await this.checkFrontendFile(uri);
    }
  }

  private async checkFrontendFile(uri: vscode.Uri): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      this.checkFrontendDocument(doc);
    } catch {
      // Ignore
    }
  }

  private checkFrontendDocument(doc: vscode.TextDocument): void {
    // If no backend routes exist anywhere in the workspace yet, avoid false-positive error noise
    if (this.backendRoutes.size === 0) {
      this.apiDiagnosticCollection.delete(doc.uri);
      return;
    }

    const text = doc.getText();
    const diagnostics: vscode.Diagnostic[] = [];
    const lines = text.split(/\r?\n/);

    // Regex to match API calls: fetch("/api/..."), axios.get("/api/..."), axios("/api/..."), etc.
    const apiCallRegex = /(?:fetch|(?:axios|api|client|httpClient)(?:\.(?:get|post|put|delete|patch|request))?)\s*\(\s*[`'"](\/api\/[^`'"]+)[`'"]/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      apiCallRegex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = apiCallRegex.exec(line)) !== null) {
        const rawCalledRoute = match[1];
        const normalizedCalled = this.normalizeRoute(rawCalledRoute);

        // Check if there is a matching backend route
        const exists = this.backendRoutes.has(normalizedCalled);
        if (!exists) {
          const colIndex = match.index + match[0].indexOf(rawCalledRoute);
          const range = new vscode.Range(i, colIndex, i, colIndex + rawCalledRoute.length);

          const diagnostic = new vscode.Diagnostic(
            range,
            `RepoPilot: API route '${rawCalledRoute}' has no matching backend endpoint definition.`,
            vscode.DiagnosticSeverity.Error
          );
          diagnostic.source = 'RepoPilot (API Contract)';
          diagnostics.push(diagnostic);
        }
      }
    }

    this.apiDiagnosticCollection.set(doc.uri, diagnostics);
  }

  /**
   * Normalizes route paths so that parameter variations match:
   * /api/v1/users/{id}  ==  /api/v1/users/:id  ==  /api/v1/users/${id}
   */
  public normalizeRoute(route: string): string {
    // 1. Strip query params: "/api/users?limit=10" -> "/api/users"
    let clean = route.split('?')[0].trim();

    // 2. Normalize template literal expressions: "${id}" or "${userId}" -> ":param"
    clean = clean.replace(/\$\{[^}]+\}/g, ':param');

    // 3. Normalize path parameters: "{id}", "{user_id:int}", or ":id" -> ":param"
    clean = clean.replace(/\{[^}]+\}/g, ':param');
    clean = clean.replace(/:[a-zA-Z0-9_]+/g, ':param');

    // 4. Strip trailing slashes (except root "/")
    clean = clean.replace(/\/+$/, '');
    if (!clean.startsWith('/')) {
      clean = '/' + clean;
    }

    return clean.toLowerCase();
  }

  public dispose(): void {
    this.depDiagnosticCollection.dispose();
    this.apiDiagnosticCollection.dispose();
  }
}
