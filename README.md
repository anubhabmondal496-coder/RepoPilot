# 🚀 RepoPilot

> **Intelligent Autonomous Repository Co-Pilot & Automation Engine**  
> Streamlining repository management, code inspection, intelligent documentation synthesis, and end-to-end hackathon / project submission workflows.

---

<p align="center">
  <img src="assets/Diagram.png" alt="RepoPilot System Architecture" width="100%" />
</p>

<p align="center">
  <b>Figure 1:</b> <em>RepoPilot End-to-End Architecture Flowchart</em>
</p>

---

## 📌 Overview

**RepoPilot** is an agentic AI developer co-pilot engineered to automate end-to-end repository maintenance and submission preparation. From executing everyday Git routines and API route audits to refactoring project hierarchies and simulating technical judge Q&A sessions, RepoPilot bridges developer intent with verified, production-ready deliverables.

Powered by a **Hybrid Execution Engine** and a multi-model **Agent Brain**, RepoPilot allows developers to toggle between safe interactive previews and high-velocity autonomous runs, all validated against strict runtime schemas.

---

## 🏛️ System Architecture

The RepoPilot pipeline is organized into five core stages as illustrated in the system architecture diagram:

```
┌──────────────────┐     ┌────────────────┐     ┌────────────────┐     ┌──────────────┐     ┌────────────────────────┐
│ User Requirements│ ──► │  Hybrid Engine │ ──► │  Agent Brain   │ ──► │ Verification │ ──► │ Deliverables & Stage   │
└──────────────────┘     └────────────────┘     └────────────────┘     └──────────────┘     └────────────────────────┘
```

### 1. 🎯 User Requirements (Input Modules)
RepoPilot captures developer tasks through terminal triggers and workspace analysis:
- **Checks Git Status & Pushes**: Tracks working tree state, automates meaningful stage/commit messages, and handles remote synchronization.
- **Checks API Route**: Inspects endpoint signatures, verifies HTTP handlers, and checks payload integrity across backend routes.
- **Finds Bugs in the Code**: Identifies syntax issues, semantic regressions, unhandled exceptions, and runtime anti-patterns.
- **Organizes VS Code File Structure**: Restructures messy repositories into standardized, modular, and maintainable folder hierarchies conforming to modern framework conventions.

### 2. ⚡ Hybrid Engine
A dual-mode operational switch that balances safety with developer speed:
- **Preview Mode**: Interactive dry-run mode providing diffs, command dry-runs, and human-in-the-loop confirmation before making file modifications or executing critical scripts.
- **Turbo Mode**: Autonomous accelerated execution mode that batches tasks, directly applies validated code fixes, and executes multi-step workflows with minimal friction.

### 3. 🧠 Agent Brain (Model Orchestration Layer)
A specialized multi-agent consensus and automation layer:
- **Gemini 1.5 Flash**: Delivers rapid multimodal analysis, high-context comprehension for extensive codebases, and powers technical documentation drafting.
- **Groq (Llama-3.3-70B)**: Ultra-low latency reasoning engine tailored for lightning-fast code analysis, deep bug hunting, and structural refactoring.
- **Playwright Automator**: Headless browser automation agent capable of navigating web portals, scraping submission forms, inserting project metadata, and managing automated submissions.

### 4. 🛡️ Verification & Guardrails
Ensures system stability and prevents hallucinated actions or malformed outputs:
- **Zod Schemas**: Strict schema validation enforcing typed contracts for all agent outputs, tool calls, and API responses.
- **Documentation Pipeline**: Verifies markdown integrity, cross-references internal links, and ensures technical accuracy across generated docs.

### 5. 📦 Deliverables & Stages
Produces concrete, review-ready artifacts:
- **Documentation Suite & Visualization**: Comprehensive architecture guides, interactive diagrams, and API references.
- **README.md & Markdown Files Updation**: Dynamic synchronization of `README.md`, changelogs, setup instructions, and contributing guidelines.
- **AI Judge Q&A Simulator**: Interactive evaluator simulating pitch reviews and hackathon judging criteria, providing critical feedback and sample defense Q&A.

---

## 🛠️ Tech Stack & Integrations

| Layer | Technologies & Frameworks |
|---|---|
| **Core Runtime** | Node.js / TypeScript |
| **Agent Intelligence** | Google Gemini 1.5 Flash, Groq (Llama-3.3-70B) |
| **Browser Automation** | Playwright |
| **Data Validation** | Zod |
| **Version Control** | Git & GitHub CLI |
| **Workspace & Editor** | VS Code Environment & Extensions |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- Git (configured locally)
- API Keys for Google Gemini and Groq

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/RepoPilot.git
   cd RepoPilot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   HEADLESS_BROWSER=true
   ```

---

## 💻 Usage

### Running RepoPilot via Terminal Command

Launch RepoPilot with your desired operational mode:

#### 1. Preview Mode (Safe / Interactive)
```bash
npx repopilot --preview
```
*Allows you to inspect proposed Git operations, code fixes, and file restructuring before changes are applied.*

#### 2. Turbo Mode (Autonomous Fast-Track)
```bash
npx repopilot --turbo
```
*Autonomously processes repository issues, updates documentation, runs verification schemas, and commits approved changes.*

---

## 📋 Core Workflows

### 🔍 Code & API Health Check
```bash
npx repopilot check --routes --bugs
```
Scans routes for broken references and executes deep static bug detection powered by **Llama-3.3-70B** on Groq.

### 📁 VS Code Structure Optimization
```bash
npx repopilot organize
```
Analyzes root directory layout and moves misplaced configs, assets, and source files into recommended conventions.

### 📝 Automated Documentation Generation
```bash
npx repopilot docs --generate
```
Synthesizes project changes using **Gemini 1.5 Flash**, updates `README.md` and related markdown guides, and validates structure through **Zod Schemas**.

### 🤖 Hackathon & Submission Automator
```bash
npx repopilot submit --platform <devpost|mlh|custom>
npx repopilot simulate-judge
```
Employs the **Playwright Automator** to scrape submission fields and insert project data, while launching the **AI Judge Q&A Simulator** to prepare you for technical defense.

---

## 🗺️ Roadmap

- [x] Initial architecture definition & diagram design
- [ ] Hybrid Engine CLI implementation (`--preview` vs `--turbo`)
- [ ] Agent Brain routing (Gemini 1.5 Flash + Groq Llama-3.3-70B)
- [ ] Zod schema validator enforcement for agent tool calls
- [ ] Playwright web submission automator integration
- [ ] AI Judge interactive terminal evaluation module

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
