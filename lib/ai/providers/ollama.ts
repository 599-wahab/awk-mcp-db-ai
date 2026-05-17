// lib/ai/providers/ollama.ts
import { AIProvider } from '../types';
import {
  buildExplanationPrompt,
  buildFixSqlPrompt,
  buildSqlPrompt,
} from '../sql-prompts';

export class OllamaProvider implements AIProvider {
  private defaultModel = 'llama2';
  private defaultBaseUrl = 'http://localhost:11434';

  private async callOllama(
    prompt: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    const url = `${baseUrl || this.defaultBaseUrl}/api/generate`;
    const modelName = model || this.defaultModel;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  async generateSQL(question: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    return this.callOllama(buildSqlPrompt(question, schema), baseUrl, model);
  }

  async generateExplanation(question: string, result: any[], apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    return this.callOllama(buildExplanationPrompt(question, result), baseUrl, model);
  }

  async fixSQL(sql: string, error: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    return this.callOllama(buildFixSqlPrompt(sql, error, schema), baseUrl, model);
  }
}
