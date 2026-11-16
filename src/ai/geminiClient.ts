import type * as vscode from 'vscode';

export const GEMINI_API_KEY_SECRET = 'repopilot.geminiApiKey';

export interface GeminiResponse {
  text?: string;
}

export interface GeminiModelClient {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
      };
    }): Promise<GeminiResponse>;
  };
}

function getVSCode(): typeof import('vscode') | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('vscode');
  } catch {
    return undefined;
  }
}

export class GeminiClient {
  /**
   * Retrieves the Gemini API key from VS Code SecretStorage or environment fallback.
   */
  public static async getApiKey(context?: vscode.ExtensionContext): Promise<string | undefined> {
    // 1. Try VS Code SecretStorage if context is available
    if (context) {
      try {
        const secretKey = await context.secrets.get(GEMINI_API_KEY_SECRET);
        if (secretKey && secretKey.trim()) {
          return secretKey.trim();
        }
      } catch {
        // Fallback
      }
    }

    // 2. Try process.env fallback
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      return process.env.GEMINI_API_KEY.trim();
    }

    return undefined;
  }

  /**
   * Securely prompts user for Gemini API Key and stores it in SecretStorage.
   */
  public static async setApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    const vsc = getVSCode();
    if (!vsc) {
      return undefined;
    }

    const input = await vsc.window.showInputBox({
      title: 'RepoPilot: Set Google Gemini API Key',
      prompt: 'Enter your Gemini API key (stored securely in VS Code SecretStorage)',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'AIzaSy...'
    });

    if (!input || !input.trim()) {
      return undefined;
    }

    const key = input.trim();
    await context.secrets.store(GEMINI_API_KEY_SECRET, key);
    vsc.window.showInformationMessage('RepoPilot: Gemini API key has been securely stored.');
    return key;
  }

  /**
   * Gets existing API key or prompts user if not found.
   */
  public static async getOrPromptApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    const existingKey = await this.getApiKey(context);
    if (existingKey) {
      return existingKey;
    }

    const vsc = getVSCode();
    if (!vsc) {
      return undefined;
    }

    const selection = await vsc.window.showWarningMessage(
      'RepoPilot: Google Gemini API key is required to run Turbo Mode.',
      'Enter API Key',
      'Cancel'
    );

    if (selection === 'Enter API Key') {
      return await this.setApiKey(context);
    }

    return undefined;
  }

  /**
   * Synthesizes full project documentation and GitDiagram architecture overview via Gemini.
   */
  public static async generateDocumentation(apiKey: string, workspaceSummary: string): Promise<string> {
    const genaiModule = await (import('@google/genai') as Promise<{
      GoogleGenAI: new (opts: { apiKey: string }) => GeminiModelClient;
    }>);
    const ai = new genaiModule.GoogleGenAI({ apiKey });

    const systemInstruction = `You are RepoPilot's lead technical architect and documentation synthesizer.
Analyze the provided workspace snapshot and generate a production-grade, highly structured README.md in GitHub Flavored Markdown.

Your generated Markdown MUST strictly include the following sections:
1. # <Project Title> with a concise, high-impact executive summary and badges.
2. ## 🏛️ System Architecture & File Structure
   - Do NOT use mermaid.js code blocks.
   - Embed an interactive GitDiagram badge and direct link using the GitDiagram URL provided in the snapshot:
     [![View Interactive Architecture on GitDiagram](https://img.shields.io/badge/Interactive_Architecture-GitDiagram-5865F2?style=for-the-badge&logo=git&logoColor=white)](<GitDiagram URL>)
     > 🔗 **Interactive Visual Hierarchy:** Explore and navigate the live visual file tree and module dependencies at [<GitDiagram URL>](<GitDiagram URL>).
   - An annotated directory tree block showing the key folders, responsibilities, and components.
3. ## 🔌 Technical Specifications & API Contracts / Hardware Pinouts
   - A detailed Markdown table of all detected API routes (Method, Endpoint, Description, Handler).
   - If hardware/embedded code is detected (e.g. Arduino, ESP32, Raspberry Pi, GPIO, Pin definitions), a Markdown table of Hardware Pinouts (Pin, Type, Direction, Connected Component/Signal).
4. ## 🛠️ Tech Stack & Requirements
   - Table or organized list of runtime, frameworks, libraries, and tools.
5. ## 🚀 Quickstart & Installation
   - Step-by-step setup instructions, environment variables configuration, and run commands.

RULES:
- Synthesize based strictly on the provided workspace code, routes, and dependencies.
- Output ONLY the Markdown content. Do not enclose the entire output in triple backticks.`;

    const prompt = `Here is the comprehensive workspace context and code snapshot:

${workspaceSummary}

Please synthesize the complete, production-ready README.md now.`;

    // Try Gemini 3.8 Flash first, fallback to Gemini 2.5 Flash if needed
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash'];
    let lastError: unknown;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction
          }
        });

        let markdown = response.text || '';

        // Strip accidental leading/trailing code fence wrapping if entire output was enclosed
        if (markdown.startsWith('```markdown')) {
          markdown = markdown.replace(/^```markdown\r?\n/, '');
          markdown = markdown.replace(/\r?\n```\s*$/, '');
        } else if (markdown.startsWith('```')) {
          markdown = markdown.replace(/^```\r?\n/, '');
          markdown = markdown.replace(/\r?\n```\s*$/, '');
        }

        return markdown.trim();
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('404') || msg.includes('not found') || msg.includes('unsupported')) {
          continue;
        }
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('Gemini API rate limit exceeded. Please wait a moment before trying again.');
        } else if (msg.includes('API_KEY_INVALID') || msg.includes('403') || msg.includes('UNAUTHENTICATED')) {
          throw new Error('Invalid Gemini API Key. Please update your key using "RepoPilot: Set Gemini API Key".');
        }
      }
    }

    const finalMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Gemini synthesis failed: ${finalMsg}`);
  }
}
