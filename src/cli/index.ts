import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GitService } from '../services/gitService';
import { SecurityScanner } from '../services/securityScanner';
import { ContractChecker } from '../services/contractChecker';
import * as readline from 'readline';
import { GeneratorService } from '../services/generatorService';
import { InteractiveJudge } from '../services/interactiveJudge';
import { DepFixer } from '../services/depFixer';
import { runTurboCore } from '../services/turboEngine';
import { BugFixerEngine } from '../services/bugFixerEngine';
import { WorkspaceOrganizer } from '../services/workspaceOrganizer';
import { PlaywrightAutomator } from '../automation/playwrightAutomator';

export interface RepoPilotConfig {
  mode: 'turbo' | 'preview';
  customCommands?: Record<string, string>;
}

const CONFIG_FILE = path.join(process.cwd(), '.repopilot.json');

export function loadConfig(): RepoPilotConfig {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      // Fallback
    }
  }
  return {
    mode: 'preview',
    customCommands: {}
  };
}

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
  console.log('Core Mode Commands:');
  console.log('  \x1b[32mrepopilot --enable turbo mode\x1b[0m      Autonomous workflow, checks & git push (halts on conflicts)');
  console.log('  \x1b[32mrepopilot --enable preview mode\x1b[0m    Inspect code overview, routes, and system architecture');
  console.log('\nGeneration & Presentation Commands:');
  console.log('  \x1b[32mrepopilot --generate qna\x1b[0m           Generate hackathon Judge Q&A session guide (docs/JUDGE_QNA.md)');
  console.log('  \x1b[32mrepopilot --generate pitch\x1b[0m         Generate timed 3-5 minute presentation script (docs/PITCH_SCRIPT.md)');
  console.log('\nDiagnostic & Security Commands:');
  console.log('  \x1b[32mrepopilot --check status\x1b[0m           Verify frontend-backend route contracts and API key safety');
  console.log('  \x1b[32mrepopilot --check health\x1b[0m           Full security audit (dangerous calls, CORS, .env leaks)');
  console.log('\nWorkspace & Automation Tools:');
  console.log('  \x1b[32mrepopilot --organize\x1b[0m               Organize VS Code file hierarchy and docs/PROJECT_STRUCTURE.md');
  console.log('  \x1b[32mrepopilot --automate-submit\x1b[0m        Synthesize hackathon portal submission payload and Playwright spec');
  console.log('  \x1b[32mrepopilot --interactive-judge\x1b[0m     Live terminal interview with AI judge grading your defense');
  console.log('  \x1b[32mrepopilot --fix-deps\x1b[0m              Autonomously append missing imports to requirements.txt');
  console.log('  \x1b[32mrepopilot --help\x1b[0m                  Display this reference menu\n');
}

function getCliGeminiApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/GEMINI_API_KEY\s*=\s*['"]?([^\s'"\r\n]+)['"]?/);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // Ignore
    }
  }
  return undefined;
}

export async function handleEnable(tokens: string[]): Promise<void> {
  const target = tokens.join(' ').toLowerCase().trim();
  const config = loadConfig();

  if (target.includes('turbo')) {
    config.mode = 'turbo';
    saveConfig(config);
    printHeader();
    console.log('⚡ \x1b[1m\x1b[33mTurbo Mode Activated\x1b[0m');
    console.log('   Autonomous search & fix engine: repairing bugs, dependencies, security & docs...');
    console.log('──────────────────────────────────────────────────');

    const apiKey = getCliGeminiApiKey();
    if (!apiKey) {
      console.log('⚠️ GEMINI_API_KEY not found in environment or .env file.');
      console.log('   (Note: Set GEMINI_API_KEY in .env or run in VS Code using "RepoPilot: Set Gemini API Key")\n');
    }

    const bugFixer = new BugFixerEngine(process.cwd(), apiKey);
    const fixResult = await bugFixer.executePipeline({ mode: 'turbo' });

    console.log('⚡ Initiating Turbo Git Push with merge conflict protection...');
    const gitService = new GitService();
    const result = gitService.executeTurboPush();

    if (result.haltedForConflict) {
      console.log(`\n⚠️  \x1b[31m${result.message}\x1b[0m`);
      console.log('   Manual resolution required before push can proceed.\n');
    } else {
      console.log(`\n✔ \x1b[32m${result.message}\x1b[0m`);
      console.log(`   RepoPilot Turbo completed (${fixResult.bugsFixedCount} issue(s) resolved).\n`);
    }
  } else if (target.includes('preview')) {
    config.mode = 'preview';
    saveConfig(config);
    printHeader();
    console.log('🔍 \x1b[1m\x1b[34mPreview Mode Activated\x1b[0m');
    console.log('   Inspecting codebase, routes, security, and system architecture...');
    console.log('──────────────────────────────────────────────────');

    const apiKey = getCliGeminiApiKey();
    const bugFixer = new BugFixerEngine(process.cwd(), apiKey);

    // Prompt for consent in terminal CLI
    const fixResult = await bugFixer.executePipeline({
      mode: 'preview',
      onPromptConsent: async (bugs) => {
        if (bugs.length === 0) {
          return false;
        }
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise<boolean>((resolve) => {
          rl.question(`\n❓ Would you like RepoPilot to apply fixes for these ${bugs.length} issue(s)? (y/N): `, (ans) => {
            rl.close();
            resolve(ans.trim().toLowerCase() === 'y' || ans.trim().toLowerCase() === 'yes');
          });
        });
      }
    });

    const generator = new GeneratorService();
    const overview = generator.generateArchitectureOverview();
    console.log(overview);

    if (fixResult.userConsented && fixResult.bugsFixedCount > 0) {
      console.log(`✔ Applied ${fixResult.bugsFixedCount} fix(es) with your consent.\n`);
    } else {
      console.log('🔍 Safe preview complete. No files modified.\n');
    }
  } else {
    console.error(`\n✘ Invalid mode "${target}". Use "--enable turbo mode" or "--enable preview mode".\n`);
    process.exit(1);
  }
}

export function handleGenerate(tokens: string[]): void {
  const target = tokens.join(' ').toLowerCase().trim();
  const generator = new GeneratorService();

  if (target.includes('qna')) {
    printHeader();
    console.log('🎯 \x1b[1mGenerating Hackathon Judge Q&A Defense Matrix...\x1b[0m');
    console.log('──────────────────────────────────────────────────');
    const { qnaPath } = generator.generateQnASession();
    console.log(`✔ Created: \x1b[32m${qnaPath}\x1b[0m`);
    console.log('   Includes Architecture, API Security, Scalability, and Stress-test answers.');
    console.log('──────────────────────────────────────────────────\n');
  } else if (target.includes('pitch')) {
    printHeader();
    console.log('🎤 \x1b[1mGenerating Timed 3-5 Minute Pitch Script...\x1b[0m');
    console.log('──────────────────────────────────────────────────');
    const { scriptPath } = generator.generatePitchScript();
    console.log(`✔ Created: \x1b[32m${scriptPath}\x1b[0m`);
    console.log('   Includes Hook (0:45), Live Demo (2:15), Tech Deep Dive (3:15), and Closing.');
    console.log('──────────────────────────────────────────────────\n');
  } else {
    console.error(`\n✘ Unknown generator command "${target}". Use "--generate qna" or "--generate pitch".\n`);
    process.exit(1);
  }
}

export function handleCheck(tokens: string[]): void {
  const target = tokens.join(' ').toLowerCase().trim();

  if (target.includes('status')) {
    printHeader();
    console.log('🔍 \x1b[1mChecking API Contracts & Secret Safety...\x1b[0m');
    console.log('──────────────────────────────────────────────────');
    const checker = new ContractChecker();
    const report = checker.checkSystemStatus();

    console.log(`Backend Endpoints:   ${report.backendRoutesCount} defined`);
    console.log(`Frontend API Calls:  ${report.frontendCallsCount} detected`);
    console.log(`Connected Routes:    \x1b[32m${report.connectedCount} healthy\x1b[0m`);
    
    if (report.orphanedCount > 0) {
      console.log(`Orphaned Routes:     \x1b[31m${report.orphanedCount} unmatched\x1b[0m`);
      report.details.unmatchedFrontendCalls.forEach((c) => {
        console.log(`  • [${c.file}:${c.line}] ${c.rawRoute} has NO backend endpoint!`);
      });
    }

    console.log(`\nAPI Keys Security:   ${report.areApiKeysSafe ? '\x1b[32m✔ All keys safe\x1b[0m' : '\x1b[31m🚨 Exposed keys detected!\x1b[0m'}`);
    console.log(`Summary:             ${report.summary}`);
    console.log('──────────────────────────────────────────────────\n');
  } else if (target.includes('health')) {
    printHeader();
    console.log('🛡️ \x1b[1mRunning Security & Vulnerability Audit...\x1b[0m');
    console.log('──────────────────────────────────────────────────');
    const scanner = new SecurityScanner();
    const report = scanner.runFullSecurityAudit();

    console.log(`Total Findings:      ${report.totalFindings}`);
    console.log(`Critical Risks:      ${report.criticalCount > 0 ? `\x1b[31m${report.criticalCount}\x1b[0m` : '\x1b[32m0\x1b[0m'}`);
    console.log(`High Priority:       ${report.highCount > 0 ? `\x1b[33m${report.highCount}\x1b[0m` : '0'}`);
    console.log(`Medium Priority:     ${report.mediumCount}`);
    console.log(`\n${report.summaryMessage}`);

    if (report.findings.length > 0) {
      console.log('\nDetails:');
      report.findings.forEach((f) => {
        const color = f.severity === 'CRITICAL' ? '\x1b[31m' : f.severity === 'HIGH' ? '\x1b[33m' : '\x1b[36m';
        console.log(`  • ${color}[${f.severity}]\x1b[0m ${f.file}:${f.line} -> ${f.recommendation}`);
      });
    }
    console.log('──────────────────────────────────────────────────\n');
  } else {
    console.error(`\n✘ Unknown check target "${target}". Use "--check status" or "--check health".\n`);
    process.exit(1);
  }
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  // 1. repopilot --enable turbo mode / preview mode
  const enableIndex = argv.indexOf('--enable');
  if (enableIndex !== -1) {
    const tokens = argv.slice(enableIndex + 1);
    await handleEnable(tokens);
    return;
  }

  // 2. repopilot --generate qna / pitch
  const genIndex = argv.indexOf('--generate');
  if (genIndex !== -1) {
    const tokens = argv.slice(genIndex + 1);
    handleGenerate(tokens);
    return;
  }

  // 3. repopilot --check status / health
  const checkIndex = argv.indexOf('--check');
  if (checkIndex !== -1) {
    const tokens = argv.slice(checkIndex + 1);
    handleCheck(tokens);
    return;
  }

  // 4. repopilot --organize
  if (argv.includes('--organize') || argv[0] === 'organize') {
    printHeader();
    console.log('📁 \x1b[1mOrganizing VS Code Workspace File Structure...\x1b[0m');
    console.log('──────────────────────────────────────────────────');
    const organizer = new WorkspaceOrganizer(process.cwd());
    const res = organizer.organize({ autoFix: true });
    if (res.createdDirs.length > 0) {
      console.log(`✔ Created standard directories: [${res.createdDirs.join(', ')}]`);
    } else {
      console.log('✔ Standard directories (src, docs, assets, tests) already in place.');
    }
    if (res.gitignoreUpdated) {
      console.log('✔ Updated .gitignore with standard exclusion rules.');
    }
    console.log('✔ Generated visual structure at \x1b[32mdocs/PROJECT_STRUCTURE.md\x1b[0m');
    console.log('──────────────────────────────────────────────────\n');
    return;
  }

  // 5. repopilot --automate-submit
  if (argv.includes('--automate-submit') || argv[0] === 'submit') {
    printHeader();
    console.log('🏆 \x1b[1mGenerating Hackathon Portal Submission & Playwright Spec...\x1b[0m');
    console.log('──────────────────────────────────────────────────');
    const automator = new PlaywrightAutomator(process.cwd());
    const res = automator.generateSubmissionPayload();
    console.log(`✔ Submission Payload: \x1b[32m${res.jsonPath}\x1b[0m`);
    console.log(`✔ Markdown Preview:   \x1b[32m${res.previewPath}\x1b[0m`);
    console.log('✔ Playwright Spec:    \x1b[32mtests/portal_submission.spec.ts\x1b[0m');
    console.log('──────────────────────────────────────────────────\n');
    return;
  }

  // 6. repopilot --interactive-judge
  if (argv.includes('--interactive-judge') || argv[0] === 'judge') {
    const judge = new InteractiveJudge();
    await judge.startSession();
    return;
  }

  // 7. repopilot --fix-deps
  if (argv.includes('--fix-deps')) {
    printHeader();
    console.log('📦 \x1b[1mAutonomously Fixing Missing Dependencies...\x1b[0m');
    const fixer = new DepFixer();
    const result = fixer.fixMissingDependencies();
    if (result.added.length > 0) {
      console.log(`✔ Successfully added ${result.added.length} package(s) to requirements.txt:`);
      result.added.forEach((p) => console.log(`   + ${p}`));
    } else {
      console.log('✔ All Python imports are already accounted for in requirements.txt.');
    }
    console.log('──────────────────────────────────────────────────\n');
    return;
  }

  // Custom commands from .repopilot.json
  const config = loadConfig();
  const customCmd = argv[0];
  if (config.customCommands && config.customCommands[customCmd]) {
    printHeader();
    console.log(`Running custom command: \x1b[32m${customCmd}\x1b[0m`);
    console.log('──────────────────────────────────────────────────');
    try {
      execSync(config.customCommands[customCmd], { stdio: 'inherit', cwd: process.cwd() });
    } catch (err: unknown) {
      const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status?: number }).status : 1;
      process.exit(status || 1);
    }
    return;
  }

  console.error(`\n✘ Unknown command: "${argv.join(' ')}"`);
  console.log('Run \x1b[32mrepopilot --help\x1b[0m to view available commands.\n');
  process.exit(1);
}

if (require.main === module) {
  runCli()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
