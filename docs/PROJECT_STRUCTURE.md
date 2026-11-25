# 📁 Project File Structure & Module Organization

> **Audited and organized by RepoPilot Workspace Organizer**  
> System Blueprint: [Interactive GitDiagram](https://gitdiagram.com/anubhabmondal496-coder/RepoPilot)

```
RepoPilot/
├── .vscode/
├── ├── extensions.json
├── ├── launch.json
├── ├── settings.json
├── └── tasks.json
├── assets/
├── └── Diagram.png
├── bin/
├── └── repopilot.js
├── docs/
├── ├── JUDGE_QNA.md
├── └── PITCH_SCRIPT.md
├── src/
├── ├── ai/
├── ├── ├── geminiClient.ts
├── ├── └── groqClient.ts
├── ├── automation/
├── ├── └── playwrightAutomator.ts
├── ├── cli/
├── ├── └── index.ts
├── ├── commands/
├── ├── └── turboMode.ts
├── ├── git/
├── ├── └── commitDrafter.ts
├── ├── services/
├── ├── ├── bugFixerEngine.ts
├── ├── ├── contractChecker.ts
├── ├── ├── depFixer.ts
├── ├── ├── generatorService.ts
├── ├── ├── gitService.ts
├── ├── ├── interactiveJudge.ts
├── ├── ├── securityScanner.ts
├── ├── ├── turboEngine.ts
├── ├── └── workspaceOrganizer.ts
├── ├── test/
├── ├── └── extension.test.ts
├── ├── test-fixtures/
├── ├── ├── backend.py
├── ├── ├── frontend.ts
├── ├── └── requirements.txt
├── ├── verification/
├── ├── └── schemas.ts
├── ├── watchers/
├── ├── └── healthMonitor.ts
├── └── extension.ts
├── tests/
├── .env
├── .repopilot.json
├── .vscode-test.mjs
├── .vscodeignore
├── CHANGELOG.md
├── Diagram.png
├── esbuild.js
├── eslint.config.mjs
├── package-lock.json
├── package.json
├── README.backup.md
├── README.md
├── RepoPilot-icon-128x128.png
├── tsconfig.json
└── vsc-extension-quickstart.md

```

### Directory Standards & Responsibilities
- **`src/`**: Core source code, VS Code extension commands, CLI entrypoints, and Agent Brain services.
- **`docs/`**: Automatically generated pitch scripts, judge defenses, architecture breakdowns, and submission payloads.
- **`assets/`**: Architecture diagrams (`Diagram.png`), screenshots, badges, and brand assets.
- **`tests/`**: Automated test suites and Playwright E2E submission scripts.
