import { requestUrl, RequestUrlParam } from 'obsidian';

export interface LlmService {
  callJson<T>(prompt: string, variables: Record<string, string>): Promise<T>;
  callText(prompt: string, variables: Record<string, string>): Promise<string>;
  listModels(): Promise<string[]>;
}

export class OpenRouterService implements LlmService {
  private modelCache: { models: string[]; fetchedAt: number } | null = null;
  private readonly MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private apiKey: string, private model: string) {}

  updateConfig(apiKey: string, model: string): void {
    this.apiKey = apiKey;
    this.model = model;
  }

  async callJson<T>(prompt: string, variables: Record<string, string>): Promise<T> {
    const rendered = renderPrompt(prompt, variables);
    const text = await this.callWithRetry(rendered, 'json_object');
    return JSON.parse(text) as T;
  }

  async callText(prompt: string, variables: Record<string, string>): Promise<string> {
    const rendered = renderPrompt(prompt, variables);
    return this.callWithRetry(rendered, 'text');
  }

  async listModels(): Promise<string[]> {
    const now = Date.now();
    if (this.modelCache && now - this.modelCache.fetchedAt < this.MODEL_CACHE_TTL_MS) {
      return this.modelCache.models;
    }
    const resp = await requestUrl({
      url: 'https://openrouter.ai/api/v1/models',
      method: 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const data = resp.json as { data: Array<{ id: string }> };
    const models = data.data.map((m: { id: string }) => m.id);
    this.modelCache = { models, fetchedAt: now };
    return models;
  }

  private async callWithRetry(
    content: string,
    responseFormat: 'json_object' | 'text'
  ): Promise<string> {
    const delays = [1000, 2000, 4000];
    let lastError: Error = new Error('Unknown LLM error');

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await this.callOnce(content, responseFormat);
      } catch (e) {
        lastError = e as Error;
        if (attempt < delays.length) {
          await sleep(delays[attempt]);
        }
      }
    }
    throw lastError;
  }

  private async callOnce(
    content: string,
    responseFormat: 'json_object' | 'text'
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [{ role: 'user', content }],
    };
    if (responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const params: RequestUrlParam = {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'obsidian://delve',
        'X-Title': 'Delve',
      },
      body: JSON.stringify(body),
      throw: false,
    };

    const resp = await requestUrl(params);
    if (resp.status !== 200) {
      throw new Error(`OpenRouter ${resp.status}: ${resp.text.slice(0, 200)}`);
    }
    const json = resp.json as { choices: Array<{ message: { content: string } }> };
    const result = json.choices?.[0]?.message?.content;
    if (result === undefined) {
      throw new Error('OpenRouter returned empty choices');
    }
    return result;
  }
}

function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
