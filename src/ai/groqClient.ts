import * as fs from 'fs';
import * as path from 'path';
import { BugReportSchema, type BugItem } from '../verification/schemas';

let vscodeModule: typeof import('vscode') | undefined;
try {
  vscodeModule = require('vscode');
} catch {
  vscodeModule = undefined;
}

export class GroqClient {
  private static readonly SECRET_KEY = 'repopilot.groqApiKey';
  private static readonly DEFAULT_MODEL = 'llama-3.3-70b-versatile';
  private static readonly FALLBACK_MODEL = 'llama3-70b-8192';

  public static async getApiKey(context?: import('vscode').ExtensionContext): Promise<string | undefined> {
    if (context && vscodeModule) {
      const stored = await context.secrets.get(GroqClient.SECRET_KEY);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    }
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0) {
      return process.env.GROQ_API_KEY.trim();
    }
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/GROQ_API_KEY\s*=\s*['"]?([^\s'"\r\n]+)['"]?/);
        if (match && match[1]) {
          return match[1].trim();
        }
      } catch {
        // Fallback
      }
    }
    return undefined;
  }

  public static async setApiKey(context: import('vscode').ExtensionContext): Promise<string | undefined> {
    if (!vscodeModule) {
      return undefined;
    }
    const key = await vscodeModule.window.showInputBox({
      title: 'RepoPilot: Set Groq API Key',
      prompt: 'Enter your Groq API Key (starts with gsk_...) for ultra-fast Llama-3.3-70B analysis',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'gsk_...'
    });

    if (key && key.trim().length > 0) {
      await context.secrets.store(GroqClient.SECRET_KEY, key.trim());
      vscodeModule.window.showInformationMessage('✔ RepoPilot: Groq API Key saved securely.');
      return key.trim();
    }
    return undefined;
  }

  /**
   * Fast Code Audit using Groq Llama-3.3-70B with Zod schema validation
   */
  public static async fastAuditCode(
    codeSnippet: string,
    filename: string,
    apiKey: string
  ): Promise<BugItem[]> {
    const prompt = `You are a high-speed security and code quality engine for RepoPilot.
Inspect the following file "${filename}" for real bugs, syntax issues, dangerous patterns, or unhandled errors.

File content:
\`\`\`
${codeSnippet.slice(0, 4000)}
\`\`\`

Return a JSON array of discovered bugs strictly conforming to this schema:
[
  {
    "category": "security" | "dependency" | "syntax" | "general",
    "file": "${filename}",
    "line": 1,
    "description": "Clear bug description",
    "severity": "low" | "medium" | "high" | "critical",
    "suggestedFix": "Code or explanation of fix",
    "autoFixable": true
  }
]
Output ONLY valid JSON. No markdown backticks, no explanations.`;

    try {
      const response = await GroqClient.callGroqApi(
        [
          { role: 'system', content: 'You are an autonomous code auditing engine that outputs strictly JSON.' },
          { role: 'user', content: prompt }
        ],
        apiKey
      );

      if (!response) {
        return [];
      }

      const cleaned = response.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        const validated: BugItem[] = [];
        for (const item of parsed) {
          try {
            const val = BugReportSchema.shape.bugs.element.safeParse({
              ...item,
              file: filename,
              id: Math.random().toString(36).substring(2, 9)
            });
            if (val.success) {
              validated.push(val.data);
            }
          } catch {
            // Ignore malformed items
          }
        }
        return validated;
      }
    } catch {
      // Graceful fallback to passive scanner
    }
    return [];
  }

  private static async callGroqApi(
    messages: Array<{ role: string; content: string }>,
    apiKey: string,
    model: string = GroqClient.DEFAULT_MODEL
  ): Promise<string | null> {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 2048
        })
      });

      if (!res.ok) {
        if (model !== GroqClient.FALLBACK_MODEL) {
          return GroqClient.callGroqApi(messages, apiKey, GroqClient.FALLBACK_MODEL);
        }
        return null;
      }

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data?.choices?.[0]?.message?.content || null;
    } catch {
      return null;
    }
  }
}
