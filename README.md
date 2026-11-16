# 🚀 RepoPilot

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-v1.85.0+-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white)](https://marketplace.visualstudio.com/)
[![Engine Runtime](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![AI Engine](https://img.shields.io/badge/Gemini_GenAI-3.3.0-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

> **RepoPilot** is an autonomous VS Code extension and CLI orchestration platform designed for real-time repository health auditing, AST-free API contract validation, semantic Git commit drafting, and end-to-end hackathon defense synthesis. Featuring a **Dual-Mode Hybrid Engine**, it enables developers to toggle seamlessly between non-destructive passive analysis (**Preview Mode**) and fully automated execution, testing, and git operations (**Turbo Mode**).

---

## 🏛️ System Architecture & File Structure

[![View Interactive Architecture on GitDiagram](https://img.shields.io/badge/Interactive_Architecture-GitDiagram-5865F2?style=for-the-badge&logo=git&logoColor=white)](https://gitdiagram.com/anubhabmondal496-coder/RepoPilot)
> 🔗 **Interactive Visual Hierarchy:** Explore and navigate the live visual file tree and module dependencies at [https://gitdiagram.com/anubhabmondal496-coder/RepoPilot](https://gitdiagram.com/anubhabmondal496-coder/RepoPilot).

### Pipeline & Data Flow
1. **Trigger & Interface Layer:** VS Code UI commands, status bar toggles, file system event listeners, and the unified `repopilot` CLI.
2. **Hybrid Engine Controller:** Manages state persistence via `.repopilot.json` to route commands to either dry-run inspection (`preview`) or autonomous resolution (`turbo`).
3. **Core Analysis & Intelligence Services:**
   - **Contract Checker & Health Monitor:** Performs debounced, AST-free regex static analysis to reconcile backend endpoints (FastAPI/Express) with frontend client invocations (`fetch`, `axios`).
   - **Security Scanner:** Scans workspace files for leaked API keys, `.env` exposure, dangerous calls, and missing CORS protections.
   - **Dependency Resolver:** Detects unlisted third-party imports and synchronizes project manifests (`requirements.txt`, `package.json`).
   - **AI Synthesis Engine:** Leverages Google Gemini (`@google/genai`) to generate comprehensive documentation, pitch decks, and mock judge Q&A defenses.
4. **Git Automation Layer:** Integrates directly with the VS Code Git extension and native Git CLI to inspect status, generate semantic commits, and handle push workflows with strict divergence guardrails.

### Annotated Directory Tree
```
RepoPilot/
├── assets/
│   └── Diagram.png              # Architectural flow and execution diagrams
├── bin/
│   └── repopilot.js             # CLI binary launcher routing to compiled runtime
├── docs/
│   ├── JUDGE_QNA.md             # Hackathon judge technical Q&A defense script
│   └── PITCH_SCRIPT.md          # 3-5 minute timed technical presentation script
├── src/
│   ├── ai/
│   │   └── geminiClient.ts      # Gemini SDK client, SecretStorage manager, doc generator
│   ├── cli/
│   │   └── index.ts             # CLI command parser, mode toggles, interactive runners
│   ├── commands/
│   │   └── turboMode.ts         # VS Code Turbo Mode orchestrator with Git integration
│   ├── git/
│   │   └── commitDrafter.ts     # SCM provider diff analyzer & semantic commit synthesizer
│   ├── services/
│   │   ├── contractChecker.ts   # Static frontend/backend API contract matcher
│   │   ├── depFixer.ts          # Python stdlib vs missing vendor import resolver
│   │   ├── generatorService.ts  # Markdown document generator (Q&A, Pitch scripts)
│   │   ├── gitService.ts        # Child-process Git wrapper (branch, diff, push checks)
│   │   ├── interactiveJudge.ts  # Terminal-based AI judge simulation defense REPL
│   │   ├── securityScanner.ts   # Regex-based scanner for secret leaks & insecure calls
│   │   └── turboEngine.ts       # Headless pipeline executing audits, fixes, & AI calls
│   ├── test/
│   │   └── extension.test.ts    # Integration & contract test suites
│   ├── watchers/
│   │   └── healthMonitor.ts     # Passive background monitor & VS Code Diagnostics provider
│   └── extension.ts             # Extension activation lifecycle, commands, & status bar
├── esbuild.js                   # Dual-target CJS bundle configuration (extension & CLI)
├── package.json                 # Project manifests, VS Code contributions, and CLI bins
├── tsconfig.json                # TypeScript compiler configuration
└── vsc-extension-quickstart.md  # Extension development guidelines
```

---

## 🔌 Technical Specifications & API Contracts / Hardware Pinouts

RepoPilot performs real-time static code analysis and AST-free regex validation over project route declarations to catch orphaned endpoints and mismatched HTTP signatures before runtime deployment.

### Detected Backend API Routes & Static Contracts

| Method | Endpoint | Description | Handler / Originating Module |
|---|---|---|---|
| `GET` | `/api/v1/items` | Test verification fixture for route matching & diagnostics | `src/test/extension.test.ts` |
| `GET` | `/api/...` | Dynamic route pattern extracted during backend indexing | `src/watchers/healthMonitor.ts` (`extractExpressRoutes` / `extractPythonRoutes`) |
| `POST` | `/api/...` | Mutation endpoint pattern extracted during backend indexing | `src/watchers/healthMonitor.ts` (`extractExpressRoutes` / `extractPythonRoutes`) |
| `PUT` | `/api/...` | Resource update endpoint extracted during backend indexing | `src/watchers/healthMonitor.ts` (`extractExpressRoutes` / `extractPythonRoutes`) |
| `DELETE` | `/api/...` | Resource deletion endpoint extracted during backend indexing | `src/watchers/healthMonitor.ts` (`extractExpressRoutes` / `extractPythonRoutes`) |

*Note: No hardware pinouts or microcontroller peripherals (GPIO, I2C, SPI) were detected in this codebase.*

---

## 🛠️ Tech Stack & Requirements

### Core Runtime & System Dependencies
- **Node.js:** `>= 18.0.0`
- **TypeScript:** `^5.4.0`
- **VS Code Engine:** `^1.85.0`
- **Git CLI:** Configured in global system `PATH`

### Production Dependencies
- **`@google/genai` (`^3.3.0`):** Client library for high-context documentation synthesis and judge simulations.
- **`@octokit/rest` (`^22.0.1`):** GitHub REST API client for branch checks and remote repo automation.

### Build & Tooling
- **`esbuild` (`^0.28.1`):** Ultra-fast bundling for CJS targets (`dist/extension.js` and `dist/cli.js`).
- **`eslint` (`^9.39.5`) & `typescript-eslint` (`^8.36.0`):** Code standards and static typing enforcement.
- **`npm-run-all` (`^4.1.5`):** Parallel watcher orchestration for development workflows.
- **`@vscode/test-cli` & `@vscode/test-electron`:** Headless test runner for extension API validation.

---

## 🚀 Quickstart & Installation

### 1. Prerequisites & Environment Setup
Clone the repository and install required project dependencies:
```bash
git clone https://github.com/anubhabmondal496-coder/RepoPilot.git
cd RepoPilot
npm install
```

Configure your environment variable for Gemini AI capabilities (optional for local diagnostics, required for documentation and pitch generation):
```bash
# Set Gemini API Key in your shell or .env file
export GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"
```
*(Alternatively, RepoPilot securely prompts and saves the API key to VS Code's encrypted `SecretStorage` upon running extension commands).*

### 2. Compilation & Local Linking
Build the extension and CLI distribution:
```bash
# Run type checking and esbuild production bundling
npm run package

# Link CLI globally for terminal access
npm link
```

### 3. Running via CLI
RepoPilot provides a dual-mode CLI interface accessible via `repopilot`:

```bash
# Switch to Turbo Mode (Autonomous scans, fixes, and docs synthesis)
repopilot --enable turbo mode

# Switch to Preview Mode (Non-destructive inspection)
repopilot --enable preview mode

# Audit API contract matches and secret exposures
repopilot --check status

# Perform a deep security and vulnerability scan
repopilot --check health

# Autonomously resolve and add missing dependencies to requirements.txt
repopilot --fix-deps

# Synthesize hackathon deliverables
repopilot --generate qna       # Outputs docs/JUDGE_QNA.md
repopilot --generate pitch     # Outputs docs/PITCH_SCRIPT.md

# Start the interactive AI Judge Defense Simulator in your terminal
repopilot --interactive-judge
```

### 4. Running the VS Code Extension
1. Open the project directory inside VS Code.
2. Press `F5` (or select **Run > Start Debugging**) to launch an **Extension Development Host**.
3. Use `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette and execute:
   - `RepoPilot: Run Turbo Mode`
   - `RepoPilot: Draft Semantic Commit`
   - `RepoPilot: Set Gemini API Key`
   - `RepoPilot: Check API Contracts & Secret Safety`
   - `RepoPilot: Start Interactive Judge Simulator`
4. Toggle operational modes directly by clicking the status bar item: `$(zap) RepoPilot: Turbo` / `$(eye) RepoPilot: Preview`.