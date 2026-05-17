// lib/ai/providers/anthropic.ts
import { AIProvider } from '../types';
import {
  buildExplanationPrompt,
  buildFixSqlPrompt,
  buildSqlPrompt,
} from '../sql-prompts';

export class AnthropicProvider implements AIProvider {
  private defaultModel = 'claude-3-haiku-20240307';

  private getMessagesUrl(baseUrl?: string) {
    if (!baseUrl) return 'https://api.anthropic.com/v1/messages';
    const trimmed = baseUrl.replace(/\/+$/, '');
    if (trimmed.endsWith('/v1/messages')) return trimmed;
    if (trimmed.endsWith('/v1')) return `${trimmed}/messages`;
    return `${trimmed}/v1/messages`;
  }

  private async callAnthropic(
    prompt: string,
    apiKey: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    const url = this.getMessagesUrl(baseUrl);
    const modelName = model || this.defaultModel;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429) throw new Error('QUOTA_EXCEEDED');
      if (response.status === 401) throw new Error('INVALID_KEY');
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  async generateSQL(question: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    if (!apiKey) throw new Error('NO_KEY');
    return this.callAnthropic(buildSqlPrompt(question, schema), apiKey, baseUrl, model);
  }

  async generateExplanation(question: string, result: any[], apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    if (!apiKey) return `Found ${result.length} result(s).`;
    return this.callAnthropic(buildExplanationPrompt(question, result), apiKey, baseUrl, model);
  }

  async fixSQL(sql: string, error: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    if (!apiKey) throw new Error('NO_KEY');
    return this.callAnthropic(buildFixSqlPrompt(sql, error, schema), apiKey, baseUrl, model);
  }
}
