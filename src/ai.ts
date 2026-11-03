import * as vscode from 'vscode';
import { scanText } from './secrets';

export const SYSTEM_INSTRUCTION =
  'You are a coding assistant inside an IDE. Reply with the code only, in a single fenced code block, with brief comments. Never include secrets or API keys.';

export const ALLOWED_HOSTNAME = 'generativelanguage.googleapis.com';
export const MAX_PROMPT_CHARS = 8000;
export const MAX_SELECTION_CHARS = 20000;
export const MAX_RESPONSE_CHARS = 50000;
export const TIMEOUT_MS = 60000;

export interface RequestBuildResult {
  path: string;
  body: any;
}

export interface ParseResponseResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/**
 * PURE FUNCTION: Validates model name and constructs Gemini generateContent request.
 */
export function buildRequest(
  prompt: string,
  selection: string | null,
  model: string,
  fallbackToUserPrompt = false
): RequestBuildResult {
  const trimmedModel = (model || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(trimmedModel)) {
    throw new Error('Invalid model name. Model name must match /^[A-Za-z0-9._-]+$/');
  }

  const url = `https://${ALLOWED_HOSTNAME}/v1beta/models/${encodeURIComponent(trimmedModel)}:generateContent`;

  let userContent = (prompt || '').trim();
  if (selection && selection.trim().length > 0) {
    userContent = `${userContent}\n\nContext code:\n\`\`\`\n${selection.trim()}\n\`\`\``;
  }

  if (fallbackToUserPrompt) {
    userContent = `${SYSTEM_INSTRUCTION}\n\n${userContent}`;
    return {
      path: url,
      body: {
        contents: [
          {
            role: 'user',
            parts: [{ text: userContent }]
          }
        ]
      }
    };
  }

  return {
    path: url,
    body: {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }]
        }
      ]
    }
  };
}

/**
 * PURE FUNCTION: Parses Gemini response JSON safely without throwing.
 */
export function parseResponse(json: any): ParseResponseResult {
  if (!json || typeof json !== 'object') {
    return { ok: false, error: 'Empty or invalid JSON response' };
  }

  // Handle top-level safety / block reasons
  if (json.promptFeedback && json.promptFeedback.blockReason) {
    return {
      ok: false,
      error: 'Prompt blocked by safety filters'
    };
  }

  // Handle API error payload with friendly mapped error messages (never raw error text)
  if (json.error) {
    const code = Number(json.error.code);
    if (code === 400) return { ok: false, error: 'Bad request' };
    if (code === 401 || code === 403) return { ok: false, error: 'Gemini rejected the API key' };
    if (code === 404) return { ok: false, error: 'Model not found: check aiModel' };
    if (code === 429) return { ok: false, error: 'Rate limit reached, try again later' };
    if (code >= 500) return { ok: false, error: 'Gemini service error' };
    return { ok: false, error: 'Gemini service error' };
  }

  // Handle candidates
  if (!Array.isArray(json.candidates) || json.candidates.length === 0) {
    return { ok: false, error: 'Gemini service error' };
  }

  const candidate = json.candidates[0];
  const parts = candidate.content?.parts;
  const finishReason = candidate.finishReason;

  let text = '';
  if (Array.isArray(parts)) {
    text = parts.map((p: any) => (p && typeof p.text === 'string' ? p.text : '')).join('');
  }

  if (!text) {
    if (finishReason === 'SAFETY') {
      return { ok: false, error: 'Prompt blocked by safety filters' };
    }
    return { ok: false, error: 'Gemini service error' };
  }

  return { ok: true, text };
}

/**
 * PURE FUNCTION: Extracts the first fenced code block if present, otherwise returns trimmed text.
 */
export function extractCode(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const fencedRegex = /```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)```/;
  const match = fencedRegex.exec(text);
  if (match && match[1] !== undefined) {
    return match[1].trim();
  }

  return text.trim();
}

export interface AiAskResult {
  ok: boolean;
  resultId?: string;
  text?: string;
  truncated?: boolean;
  error?: string;
}

/**
 * GeminiClient handles SecretStorage access, outgoing secret scanning,
 * network calls via Node built-in fetch, and in-memory result tracking.
 */
export class GeminiClient {
  private activeAbortController?: AbortController;
  private lastResult: { resultId: string; text: string; truncated: boolean } | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async isApiKeySet(): Promise<boolean> {
    const key = await this.context.secrets.get('buildtri.geminiApiKey');
    return !!(key && key.trim().length > 0);
  }

  public async setApiKey(key: string): Promise<void> {
    await this.context.secrets.store('buildtri.geminiApiKey', key.trim());
  }

  public async clearApiKey(): Promise<void> {
    await this.context.secrets.delete('buildtri.geminiApiKey');
  }

  public cancel(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = undefined;
    }
  }

  public isBusy(): boolean {
    return !!this.activeAbortController;
  }

  public getLastResult(resultId: string): { resultId: string; text: string; truncated: boolean } | null {
    if (this.lastResult && this.lastResult.resultId === resultId) {
      return this.lastResult;
    }
    return null;
  }

  /**
   * Executes an AI prompt against Gemini.
   */
  public async ask(
    prompt: string,
    selection: string | null,
    model: string
  ): Promise<AiAskResult> {
    // 1. Check workspace trust
    if (!vscode.workspace.isTrusted) {
      return { ok: false, error: 'Workspace is not trusted. AI calls are disabled.' };
    }

    // 2. Concurrency check
    if (this.activeAbortController) {
      return { ok: false, error: 'An AI request is already in progress.' };
    }

    // 3. Validate prompt length
    if (!prompt || prompt.trim().length === 0) {
      return { ok: false, error: 'Prompt cannot be empty.' };
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return {
        ok: false,
        error: `Prompt exceeds limit of ${MAX_PROMPT_CHARS} characters (${prompt.length} chars).`
      };
    }

    // 4. Validate selection length
    if (selection && selection.length > MAX_SELECTION_CHARS) {
      return {
        ok: false,
        error: `Selected text exceeds limit of ${MAX_SELECTION_CHARS} characters (${selection.length} chars).`
      };
    }

    // 5. Secret scan on outgoing text
    const promptFindings = scanText(prompt);
    if (promptFindings.length > 0) {
      return {
        ok: false,
        error: `Text contains a possible secret (${promptFindings[0].rule}); not sent.`
      };
    }
    if (selection) {
      const selectionFindings = scanText(selection);
      if (selectionFindings.length > 0) {
        return {
          ok: false,
          error: `Text contains a possible secret (${selectionFindings[0].rule}); not sent.`
        };
      }
    }

    // 6. Check API key
    const apiKey = await this.context.secrets.get('buildtri.geminiApiKey');
    if (!apiKey || !apiKey.trim()) {
      return { ok: false, error: 'Gemini API key is not set. Run "Buildtri: Set Gemini API Key".' };
    }

    // 7. Check model name
    const trimmedModel = (model || '').trim();
    if (!trimmedModel) {
      return { ok: false, error: 'Set aiModel in config.json' };
    }

    let reqObj: RequestBuildResult;
    try {
      reqObj = buildRequest(prompt, selection, trimmedModel, false);
    } catch {
      return { ok: false, error: 'Model not found: check aiModel' };
    }

    // 8. Prepare fetch call with timeout and cancellation
    const controller = new AbortController();
    this.activeAbortController = controller;
    let isTimeout = false;

    const timeoutHandle = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, TIMEOUT_MS);

    try {
      let response = await this.callFetch(reqObj, apiKey, controller.signal);

      // If systemInstruction was rejected with 400, retry once with fallback
      if (response.status === 400) {
        try {
          const fallbackReq = buildRequest(prompt, selection, trimmedModel, true);
          response = await this.callFetch(fallbackReq, apiKey, controller.signal);
        } catch {
          // If fallback fails to build, keep original response
        }
      }

      clearTimeout(timeoutHandle);
      this.activeAbortController = undefined;

      // Map HTTP status codes to safe friendly messages
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: 'Gemini rejected the API key' };
      }
      if (response.status === 404) {
        return { ok: false, error: 'Model not found: check aiModel' };
      }
      if (response.status === 429) {
        return { ok: false, error: 'Rate limit reached, try again later' };
      }
      if (response.status >= 500) {
        return { ok: false, error: 'Gemini service error' };
      }
      if (response.status === 400) {
        return { ok: false, error: 'Bad request' };
      }
      if (!response.ok) {
        return { ok: false, error: 'Gemini service error' };
      }

      const json = await response.json();
      const parsed = parseResponse(json);
      if (!parsed.ok || !parsed.text) {
        return { ok: false, error: parsed.error || 'Gemini service error' };
      }

      // Truncate response if over 50,000 characters
      let responseText = parsed.text;
      let truncated = false;
      if (responseText.length > MAX_RESPONSE_CHARS) {
        responseText = responseText.slice(0, MAX_RESPONSE_CHARS) + '\n\n[Truncated at 50,000 characters]';
        truncated = true;
      }

      const resultId = `ai-res-${Date.now()}`;
      this.lastResult = {
        resultId,
        text: responseText,
        truncated
      };

      return {
        ok: true,
        resultId,
        text: responseText,
        truncated
      };
    } catch (err: any) {
      clearTimeout(timeoutHandle);
      this.activeAbortController = undefined;

      if (isTimeout) {
        return { ok: false, error: 'Request timed out' };
      }
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return { ok: false, error: 'Request cancelled' };
      }
      return { ok: false, error: 'Network error' };
    }
  }

  private async callFetch(
    reqObj: RequestBuildResult,
    apiKey: string,
    signal: AbortSignal
  ): Promise<Response> {
    const urlObj = new URL(reqObj.path);
    if (urlObj.hostname !== ALLOWED_HOSTNAME || urlObj.protocol !== 'https:') {
      throw new Error(`Invalid host: only https://${ALLOWED_HOSTNAME} is permitted`);
    }

    return fetch(reqObj.path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(reqObj.body),
      signal
    });
  }
}

