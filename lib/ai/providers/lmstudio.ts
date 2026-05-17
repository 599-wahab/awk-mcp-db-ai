// lib/ai/providers/lmstudio.ts
import { AIProvider } from '../types';
import {
  buildExplanationPrompt,
  buildFixSqlPrompt,
  buildSqlPrompt,
} from '../sql-prompts';

export class LMStudioProvider implements AIProvider {
  private defaultModel = 'local-model';
  private defaultBaseUrl = 'http://localhost:1234/v1';

  private async callLMStudio(
    prompt: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    const url = `${baseUrl || this.defaultBaseUrl}/chat/completions`;
    const modelName = model || this.defaultModel;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio API error: ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async generateSQL(question: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    return this.callLMStudio(buildSqlPrompt(question, schema), baseUrl, model);
  }

  async generateExplanation(question: string, result: any[], apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    return this.callLMStudio(buildExplanationPrompt(question, result), baseUrl, model);
  }

  async fixSQL(sql: string, error: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    return this.callLMStudio(buildFixSqlPrompt(sql, error, schema), baseUrl, model);
  }
}
