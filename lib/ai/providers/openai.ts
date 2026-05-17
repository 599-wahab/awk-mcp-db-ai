// lib/ai/providers/openai.ts
import { AIProvider } from '../types';
import {
  buildExplanationPrompt,
  buildFixSqlPrompt,
  buildSqlPrompt,
} from '../sql-prompts';

export class OpenAIProvider implements AIProvider {
  private defaultModel = 'gpt-3.5-turbo';

  private getChatCompletionsUrl(baseUrl?: string) {
    if (!baseUrl) return 'https://api.openai.com/v1/chat/completions';
    const trimmed = baseUrl.replace(/\/+$/, '');
    if (trimmed.endsWith('/chat/completions')) return trimmed;
    return `${trimmed}/chat/completions`;
  }

  private async callOpenAI(
    prompt: string,
    apiKey: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    const url = this.getChatCompletionsUrl(baseUrl);
    const modelName = model || this.defaultModel;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 429) throw new Error('QUOTA_EXCEEDED');
      if (response.status === 401) throw new Error('INVALID_KEY');
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async generateSQL(question: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    if (!apiKey) throw new Error('NO_KEY');
    return this.callOpenAI(buildSqlPrompt(question, schema), apiKey, baseUrl, model);
  }

  async generateExplanation(question: string, result: any[], apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    if (!apiKey) return `Found ${result.length} result(s).`;
    return this.callOpenAI(buildExplanationPrompt(question, result), apiKey, baseUrl, model);
  }

  async fixSQL(sql: string, error: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    if (!apiKey) throw new Error('NO_KEY');
    return this.callOpenAI(buildFixSqlPrompt(sql, error, schema), apiKey, baseUrl, model);
  }
}
