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

### System Data Flow & Layer Responsibilities
1. **Trigger & Interface Layer:** VS Code command palette entries, status bar toggles, file system event listeners (`vscode.workspace.createFileSystemWatcher`), and the standalone `repopilot` CLI executable.
2. **Hybrid Engine Controller:** Manages runtime execution state via `.repopilot.json` to route tasks between non-destructive dry-run inspection (`preview`) and automated code modifications (`turbo`).
3. **Core Analysis & Intelligence Services:**
   - **Contract Checker & Health Monitor:** Static regex-based endpoint parser indexing backend decorators (`@app.get`, `app.post`) and matching them against frontend fetch and axios signatures with normalized parameter paths (`:param`).
   - **Security Scanner & Secret Gate:** Scans active workspace files for API tokens, unignored `.env` occurrences, hardcoded credentials, and missing CORS declarations.
   - **Dependency Resolver (`depFixer`):** Compares third-party import trees against system package manifests (`requirements.txt`, `package.json`) to repair broken environments.
   - **AI Synthesis Engine:** Integrates `@google/genai` to analyze workspace contexts and synthesize documentation, pitch scripts, and mock judge defenses.
4. **Git Automation Layer:** Interfaces with the VS Code Git extension API and native CLI to inspect status, generate conventional commit messages, and execute push routines guarded by divergence checks.

### Annotated Directory Tree
```
RepoPilot/
├── assets/
│   └── Diagram.png                  # System architecture and execution flow diagrams
├── bin/
│   └── repopilot.js                 # Unified CLI executable launcher
├── docs/
│   ├── JUDGE_QNA.md                 # Pre-generated technical judge defense and Q&A matrix
│   └── PITCH_SCRIPT.md              # 3-5 minute presentation script and pitch breakdown
├── src/
│   ├── ai/
│   │   └── geminiClient.ts          # Google GenAI SDK interface & SecretStorage credential store
│   ├── cli/
│   │   └── index.ts                 # CLI entrypoint, argument parser, and terminal runners
│   ├── commands/
│   │   └── turboMode.ts             # Turbo mode VS Code command handler and Git push runner
│   ├── git/
│   │   └── commitDrafter.ts         # Git change analyzer and semantic commit synthesizer
│   ├── services/
│   │   ├── bugFixerEngine.ts        # Automated multi-category bug discovery and repair engine
│   │   ├── contractChecker.ts       # AST-free frontend/backend API contract reconciliation
│   │   ├── depFixer.ts              # Python stdlib filter and manifest synchronization service
│   │   ├── generatorService.ts      # Markdown synthesizer for pitch scripts and judge defense docs
│   │   ├── gitService.ts            # Native Git wrapper with merge divergence guards
│   │   ├── interactiveJudge.ts      # Terminal-based AI judge interview and scoring simulator
│   │   ├── securityScanner.ts       # Workspace secret, CORS, and dangerous call auditor
│   │   └── turboEngine.ts           # Core Turbo Mode pipeline execution orchestrator
│   ├── test/
│   │   └── extension.test.ts        # Extension test suites and contract test fixtures
│   ├── watchers/
│   │   └── healthMonitor.ts         # Passive file watcher and real-time DiagnosticCollection reporter
│   └── extension.ts                 # VS Code extension activation entrypoint and command registry
├── esbuild.js                       # Bundler script for extension and CLI builds
├── eslint.config.mjs                # ESLint code style and quality configuration
├── package.json                     # Extension manifest, commands, dependencies, and scripts
└── tsconfig.json                    # TypeScript compiler configuration
```

---

## 🔌 Technical Specifications & API Contracts / Hardware Pinouts

### Detected API Route Contracts
The background health monitor and contract checking engine statically parse and validate the following endpoint signatures across frontend and backend files:

| Method | Endpoint | Description | Handler / Source |
|---|---|---|---|
| `GET` | `/api/v1/items` | Test fixture route verifying mock item retrieval | `src/test/extension.test.ts` |
| `GET` | `/api/...` | Dynamic route match pattern for backend endpoints | `src/watchers/healthMonitor.ts` |
| `POST` | `/api/...` | Dynamic route match pattern for state mutation handlers | `src/watchers/healthMonitor.ts` |
| `GET` | `/api/...` | Regex contract pattern validating HTTP client fetches | `src/services/contractChecker.ts` |
| `POST` | `/api/...` | Regex contract pattern validating payload submission calls | `src/services/contractChecker.ts` |

*(Note: No embedded systems or hardware GPIO pinout definitions were detected in this workspace snapshot.)*

---

## 🛠️ Tech Stack & Requirements

### Core Dependencies & Runtimes
| Category | Technology | Purpose |
|---|---|---|
| **Runtime Environment** | Node.js (>= 18.0.0) | CLI and asynchronous task runtime |
| **Editor Platform** | VS Code API (^1.85.0) | Extension lifecycle, SCM viewlet, and diagnostics |
| **Language** | TypeScript (v5.4.0) | Strongly typed application architecture |
| **AI SDK** | `@google/genai` (^3.3.0) | Workspace synthesis, README drafting, and pitch generation |
| **Git & Octokit** | `@octokit/rest` (^22.0.1) | GitHub API access and remote synchronization |
| **Bundler** | esbuild (^0.28.1) | High-speed compilation for both CLI and extension targets |
| **Linting & Testing** | ESLint (^9.39.5) / `@vscode/test-cli` | Static analysis and integration testing |

---

## 🚀 Quickstart & Installation

### Prerequisites
- Node.js `v18.0.0` or higher installed.
- Git configured locally in your PATH.
- (Optional) A Google Gemini API key for AI generation features.

### 1. Clone & Install
```bash
git clone https://github.com/anubhabmondal496-coder/RepoPilot.git
cd RepoPilot
npm install
```

### 2. Build the Extension & CLI
Compile the TypeScript code using esbuild:
```bash
npm run compile
```

To run continuous file watching during development:
```bash
npm run watch
```

### 3. Environment Configuration
Set your Gemini API key in your environment or allow the extension to store it securely in VS Code `SecretStorage`:
```bash
# On Linux/macOS
export GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"

# On Windows (PowerShell)
$env:GEMINI_API_KEY="AIzaSyYourGeminiApiKeyHere"
```
Alternatively, create a `.env` file in the root directory:
```env
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
```

### 4. Running the CLI
RepoPilot can be executed directly via Node or linked globally:
```bash
# Direct execution
node bin/repopilot.js --help

# Or link globally
npm link
repopilot --help
```

### Key CLI Usage Examples:
```bash
# Switch to Turbo Mode (autonomous fixes and git workflows)
repopilot --enable turbo mode

# Switch to Preview Mode (dry-run inspections and route reviews)
repopilot --enable preview mode

# Validate API contracts and scan for leaked secrets
repopilot --check status
repopilot --check health

# Generate presentation materials
repopilot --generate qna
repopilot --generate pitch

# Launch the terminal AI Judge simulator
repopilot --interactive-judge
```

### 5. Running the Extension in VS Code
1. Open the project folder in VS Code.
2. Press `F5` to start a new **Extension Development Host** window.
3. Access commands via `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) by typing `RepoPilot:`
   - `RepoPilot: Run Turbo Mode`
   - `RepoPilot: Draft Semantic Commit`
   - `RepoPilot: Check API Contracts & Secret Safety`
   - `RepoPilot: Set Gemini API Key`