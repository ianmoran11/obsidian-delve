import { requestUrl } from 'obsidian';
import { OPENROUTER_BASE_URL } from '../constants';

export interface LlmService {
  callText(prompt: string, variables: Record<string, string>): Promise<string>;
  callJson<T>(prompt: string, variables: Record<string, string>): Promise<T>;
  listModels(): Promise<string[]>;
  updateCredentials(apiKey: string, model: string): void;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  choices: Array<{ message: { content: string } }>;
}

export class OpenRouterService implements LlmService {
  private apiKey: string;
  private model: string;
  private modelCache: { models: string[]; fetchedAt: number } | null = null;
  private static readonly MODEL_TTL = 5 * 60 * 1000;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  updateCredentials(apiKey: string, model: string): void {
    this.apiKey = apiKey;
    this.model = model;
  }

  async callText(prompt: string, variables: Record<string, string>): Promise<string> {
    return this.chat(this.render(prompt, variables), 'text');
  }

  async callJson<T>(prompt: string, variables: Record<string, string>): Promise<T> {
    const text = await this.chat(this.render(prompt, variables), 'json');
    return JSON.parse(text) as T;
  }

  async listModels(): Promise<string[]> {
    const now = Date.now();
    if (this.modelCache && now - this.modelCache.fetchedAt < OpenRouterService.MODEL_TTL) {
      return this.modelCache.models;
    }
    const resp = await requestUrl({
      url: `${OPENROUTER_BASE_URL}/models`,
      method: 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = resp.json as { data: Array<{ id: string }> };
    const models = data.data.map(m => m.id).sort();
    this.modelCache = { models, fetchedAt: now };
    return models;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private render(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  }

  private async chat(content: string, format: 'text' | 'json'): Promise<string> {
    const messages: ChatMessage[] = [{ role: 'user', content }];
    const body: Record<string, unknown> = { model: this.model, messages };
    if (format === 'json') body.response_format = { type: 'json_object' };

    const delays = [1000, 2000, 4000];
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const resp = await requestUrl({
          url: `${OPENROUTER_BASE_URL}/chat/completions`,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'obsidian://delve',
            'X-Title': 'Delve',
          },
          body: JSON.stringify(body),
          throw: false,
        });

        if (resp.status >= 400) {
          throw new Error(`OpenRouter HTTP ${resp.status}: ${resp.text.slice(0, 200)}`);
        }

        const data = resp.json as ChatResponse;
        return data.choices[0].message.content;
      } catch (err) {
        lastErr = err as Error;
        if (attempt < delays.length) {
          await delay(delays[attempt]);
        }
      }
    }

    throw lastErr ?? new Error('LLM call failed after retries');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
