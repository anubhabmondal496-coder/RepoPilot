import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GitService } from '../services/gitService';
import { SecurityScanner } from '../services/securityScanner';
import { ContractChecker } from '../services/contractChecker';
import { GeneratorService } from '../services/generatorService';
import { InteractiveJudge } from '../services/interactiveJudge';
import { DepFixer } from '../services/depFixer';

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
  console.log('\nBonus Intelligent Tools:');
  console.log('  \x1b[32mrepopilot --interactive-judge\x1b[0m     Live terminal interview with AI judge grading your defense');
  console.log('  \x1b[32mrepopilot --fix-deps\x1b[0m              Autonomously append missing imports to requirements.txt');
  console.log('  \x1b[32mrepopilot --help\x1b[0m                  Display this reference menu\n');
}

export function handleEnable(tokens: string[]): void {
  const target = tokens.join(' ').toLowerCase().trim();
  const config = loadConfig();

  if (target.includes('turbo')) {
    config.mode = 'turbo';
    saveConfig(config);
    printHeader();
    console.log('⚡ \x1b[1m\x1b[33mTurbo Mode Activated\x1b[0m');
    console.log('   Running pre-flight checks, conflict verification, and autonomous push...');
    console.log('──────────────────────────────────────────────────');

    const gitService = new GitService();
    const result = gitService.executeTurboPush();

    if (result.haltedForConflict) {
      console.log('\n⚠️ \x1b[1m\x1b[31mCRITICAL: PUSH HALTED FOR GIT CONFLICT SAFETY!\x1b[0m');
      console.log(`   ${result.message}`);
      if (result.conflictedFiles && result.conflictedFiles.length > 0) {
        console.log('   Conflicted Files:');
        result.conflictedFiles.forEach((f) => console.log(`     • ${f}`));
      }
      console.log('   \x1b[33mAction Required: Resolve merge conflict markers (<<<<<<<) and commit manually.\x1b[0m\n');
    } else if (result.success) {
      console.log(`\n✔ \x1b[32mTurbo Push Succeeded:\x1b[0m ${result.message}\n`);
    } else {
      console.log(`\n✘ \x1b[31mTurbo Push Failed:\x1b[0m ${result.message}\n`);
    }
  } else if (target.includes('preview')) {
    config.mode = 'preview';
    saveConfig(config);
    printHeader();
    console.log('🔍 \x1b[1m\x1b[34mPreview Mode Activated\x1b[0m');
    
    const generator = new GeneratorService();
    const overview = generator.generateArchitectureOverview();
    console.log(overview);
  } else {
    console.error(`\n✘ Unknown mode "${target}". Use "turbo mode" or "preview mode".\n`);
    process.exit(1);
  }
}

export function handleGenerate(tokens: string[]): void {
  const target = tokens.join(' ').toLowerCase().trim();
  const generator = new GeneratorService();

  if (target.includes('qna')) {
    printHeader();
    console.log('🎯 \x1b[1mGenerating AI Judge Q&A Simulator Guide...\x1b[0m');
    const { qnaPath } = generator.generateQnASession();
    console.log(`✔ Created: \x1b[32m${qnaPath}\x1b[0m`);
    console.log('   Includes high-scoring answers for Architecture, Scalability, Security, and Edge Cases.');
    console.log('──────────────────────────────────────────────────\n');
  } else if (target.includes('pitch')) {
    printHeader();
    console.log('🎤 \x1b[1mGenerating 3-5 Minute Hackathon Pitch Script...\x1b[0m');
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
    handleEnable(tokens);
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

  // 4. repopilot --interactive-judge
  if (argv.includes('--interactive-judge') || argv[0] === 'judge') {
    const judge = new InteractiveJudge();
    await judge.startSession();
    return;
  }

  // 5. repopilot --fix-deps
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
  runCli();
}
