import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface RepoPilotConfig {
  mode: 'turbo' | 'preview';
  customCommands?: Record<string, string>;
}

export type CommandAction = (args: string[]) => void | Promise<void>;

export interface CommandDefinition {
  name: string;
  description: string;
  action: CommandAction;
}

const CONFIG_FILE = path.join(process.cwd(), '.repopilot.json');

/**
 * Loads configuration from .repopilot.json or returns default settings.
 */
export function loadConfig(): RepoPilotConfig {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      // Return default on parse failure
    }
  }
  return {
    mode: 'preview',
    customCommands: {}
  };
}

/**
 * Persists configuration to .repopilot.json.
 */
export function saveConfig(config: RepoPilotConfig): boolean {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✘ Failed to save .repopilot.json: ${message}`);
    return false;
  }
}

export function printHeader(): void {
  console.log('\n🚀 \x1b[1m\x1b[36mRepoPilot CLI\x1b[0m [Hybrid Engine]');
  console.log('──────────────────────────────────────────────────');
}

export function printHelp(): void {
  printHeader();
  console.log('Usage:');
  console.log('  repopilot [options] [command]');
  console.log('\nBuilt-in Mode Commands:');
  console.log('  \x1b[32mrepopilot --enable turbo mode\x1b[0m      Activate Turbo Mode (autonomous execution)');
  console.log('  \x1b[32mrepopilot --enable preview mode\x1b[0m    Activate Preview Mode (safe dry-run inspection)');
  console.log('  \x1b[32mrepopilot --status\x1b[0m                 Display active mode and workspace state');
  console.log('  \x1b[32mrepopilot --draft-commit\x1b[0m           Synthesize conventional commit for git changes');
  console.log('  \x1b[32mrepopilot --help\x1b[0m                   Show this help menu');
  console.log('\nAdding Your Own Commands:');
  console.log('  Add custom scripts in \x1b[33m.repopilot.json\x1b[0m under "customCommands":');
  console.log('    {');
  console.log('      "customCommands": {');
  console.log('        "audit": "npm test && git status"');
  console.log('      }');
  console.log('    }');
  console.log('  Then run: \x1b[32mrepopilot audit\x1b[0m\n');
}

export function handleEnable(tokens: string[]): void {
  const target = tokens.join(' ').toLowerCase().trim();
  const config = loadConfig();

  if (target.includes('turbo')) {
    config.mode = 'turbo';
    saveConfig(config);
    printHeader();
    console.log('⚡ \x1b[1m\x1b[33mTurbo Mode Enabled\x1b[0m');
    console.log('   Autonomous execution, fast-track validation & direct fixes are now active.');
    console.log('   Configuration saved to \x1b[32m.repopilot.json\x1b[0m');
    console.log('──────────────────────────────────────────────────\n');
  } else if (target.includes('preview')) {
    config.mode = 'preview';
    saveConfig(config);
    printHeader();
    console.log('🔍 \x1b[1m\x1b[34mPreview Mode Enabled\x1b[0m');
    console.log('   Interactive inspection, diff previewing & dry-runs are now active.');
    console.log('   Configuration saved to \x1b[32m.repopilot.json\x1b[0m');
    console.log('──────────────────────────────────────────────────\n');
  } else {
    console.error(`\n✘ Unknown mode "${target}". Expected "turbo mode" or "preview mode".`);
    console.log('Example: repopilot --enable turbo mode\n');
    process.exit(1);
  }
}

export function handleStatus(): void {
  const config = loadConfig();
  printHeader();
  console.log(`Current Mode:       ${config.mode === 'turbo' ? '⚡ \x1b[33mTurbo Mode\x1b[0m' : '🔍 \x1b[34mPreview Mode\x1b[0m'}`);
  console.log(`Workspace Root:     ${process.cwd()}`);
  console.log(`Configuration:      ${fs.existsSync(CONFIG_FILE) ? '.repopilot.json (present)' : 'Default (in-memory)'}`);

  const customKeys = Object.keys(config.customCommands || {});
  if (customKeys.length > 0) {
    console.log(`Custom Commands:    ${customKeys.join(', ')}`);
  }
  console.log('──────────────────────────────────────────────────\n');
}

export function handleDraftCommit(): void {
  printHeader();
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (!status) {
      console.log('ℹ No git changes detected.');
      return;
    }
    const lines = status.split('\n');
    console.log(`Found ${lines.length} changed file(s):`);
    lines.forEach((l) => console.log(`  • ${l}`));
    console.log('\n💡 Suggested commit message:');
    if (status.includes('requirements.txt') || status.includes('package.json')) {
      console.log('  \x1b[32mfix(deps): update project dependencies\x1b[0m');
    } else if (status.includes('.py') || status.includes('/api/')) {
      console.log('  \x1b[32mfeat(api): update backend routes and handlers\x1b[0m');
    } else if (status.includes('.md')) {
      console.log('  \x1b[32mdocs: update repository documentation\x1b[0m');
    } else {
      console.log('  \x1b[32mfeat: update workspace modules\x1b[0m');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✘ Git error: ${message}`);
  }
  console.log('──────────────────────────────────────────────────\n');
}

export function runCustomCommand(commandName: string, script: string): void {
  printHeader();
  console.log(`Running custom command: \x1b[32m${commandName}\x1b[0m -> "${script}"`);
  console.log('──────────────────────────────────────────────────');
  try {
    execSync(script, { stdio: 'inherit', cwd: process.cwd() });
  } catch (err: unknown) {
    const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status?: number }).status : 1;
    console.error(`✘ Command failed with exit code ${status || 1}`);
    process.exit(status || 1);
  }
}

/**
 * Main CLI router.
 */
export function runCli(argv = process.argv.slice(2)): void {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  // Parse: repopilot --enable turbo mode
  const enableIndex = argv.indexOf('--enable');
  if (enableIndex !== -1) {
    const tokens = argv.slice(enableIndex + 1);
    handleEnable(tokens);
    return;
  }

  // Shortcuts: repopilot --turbo or repopilot --preview
  if (argv.includes('--turbo')) {
    handleEnable(['turbo', 'mode']);
    return;
  }
  if (argv.includes('--preview')) {
    handleEnable(['preview', 'mode']);
    return;
  }

  if (argv.includes('--status') || argv[0] === 'status') {
    handleStatus();
    return;
  }

  if (argv.includes('--draft-commit') || argv[0] === 'draft-commit') {
    handleDraftCommit();
    return;
  }

  // Check custom commands in .repopilot.json
  const config = loadConfig();
  const customCmd = argv[0];
  if (config.customCommands && config.customCommands[customCmd]) {
    runCustomCommand(customCmd, config.customCommands[customCmd]);
    return;
  }

  console.error(`\n✘ Unknown command or flag: "${argv.join(' ')}"`);
  console.log('Run \x1b[32mrepopilot --help\x1b[0m to view available commands.\n');
  process.exit(1);
}

// Auto-run if executed as script
if (require.main === module) {
  runCli();
}
