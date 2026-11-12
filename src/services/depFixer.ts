import * as fs from 'fs';
import * as path from 'path';

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

const ALIASES: Record<string, string> = {
  pil: 'pillow',
  cv2: 'opencv-python',
  sklearn: 'scikit-learn',
  yaml: 'pyyaml',
  bs4: 'beautifulsoup4',
  dotenv: 'python-dotenv'
};

export class DepFixer {
  private cwd: string;

  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Scans Python files and synchronizes missing imports into requirements.txt.
   */
  public fixMissingDependencies(): { added: string[]; requirementsFile: string } {
    const reqPath = path.join(this.cwd, 'requirements.txt');
    const existing = new Set<string>();

    if (fs.existsSync(reqPath)) {
      const content = fs.readFileSync(reqPath, 'utf8');
      content.split('\n').forEach((l) => {
        const clean = l.split(/[=<>#;]/)[0].trim().toLowerCase();
        if (clean && !clean.startsWith('-')) {
          existing.add(clean);
        }
      });
    }

    const pyFiles = this.collectPyFiles(this.cwd);
    const missing = new Set<string>();

    for (const file of pyFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            continue;
          }

          const imports = this.extractImports(trimmed);
          for (const imp of imports) {
            const top = imp.split('.')[0].toLowerCase();
            if (PYTHON_STDLIB.has(top) || top.startsWith('.')) {
              continue;
            }
            const canonical = ALIASES[top] || top.replace(/[-_.]/g, '-');
            if (!existing.has(canonical) && !existing.has(top)) {
              missing.add(canonical);
            }
          }
        }
      } catch {
        // Ignore read error
      }
    }

    const added = Array.from(missing);
    if (added.length > 0) {
      const appendContent = '\n# Added automatically by RepoPilot --fix-deps\n' + added.join('\n') + '\n';
      fs.appendFileSync(reqPath, appendContent, 'utf8');
    }

    return {
      added,
      requirementsFile: reqPath
    };
  }

  private extractImports(line: string): string[] {
    const list: string[] = [];
    const impMatch = line.match(/^import\s+([^#;]+)/);
    if (impMatch) {
      impMatch[1].split(',').forEach((p) => {
        const mod = p.trim().split(/\s+as\s+/)[0].trim();
        if (mod) {
          list.push(mod);
        }
      });
      return list;
    }

    const fromMatch = line.match(/^from\s+([a-zA-Z0-9_\.]+)\s+import\s+/);
    if (fromMatch) {
      list.push(fromMatch[1].trim());
      return list;
    }
    return list;
  }

  private collectPyFiles(dir: string, list: string[] = []): string[] {
    const ignoreDirs = new Set(['node_modules', 'dist', 'out', '.git', '.venv', 'venv', '__pycache__']);
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name)) {
            this.collectPyFiles(full, list);
          }
        } else if (entry.isFile() && entry.name.endsWith('.py')) {
          list.push(full);
        }
      }
    } catch {
      // Ignore
    }
    return list;
  }
}
