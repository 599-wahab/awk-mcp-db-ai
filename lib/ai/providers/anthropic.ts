// lib/ai/providers/anthropic.ts
import { AIProvider } from '../types';

export class AnthropicProvider implements AIProvider {
  private defaultModel = 'claude-3-haiku-20240307';

  private async callAnthropic(
    prompt: string,
    apiKey: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    const url = baseUrl || 'https://api.anthropic.com/v1/messages';
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
    const prompt = `You are a SQL expert. Convert this question into a SQL query.

Database Schema:
${schema}

Question: ${question}

Rules:
- Return ONLY the SQL query, no explanation
- Use proper JOINs when needed
- Use aggregate functions appropriately
- Ensure the query is safe (SELECT only)
- Use LIMIT 100 for large result sets

SQL:`;
    return this.callAnthropic(prompt, apiKey, baseUrl, model);
  }

  async generateExplanation(question: string, result: any[], apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    if (!apiKey) return `Found ${result.length} result(s).`;
    const prompt = `Explain these query results in simple terms.

Question: ${question}
Results (first 5 rows): ${JSON.stringify(result.slice(0, 5))}

Provide a brief, helpful explanation in 1-2 sentences:`;
    return this.callAnthropic(prompt, apiKey, baseUrl, model);
  }

  async fixSQL(sql: string, error: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    if (!apiKey) throw new Error('NO_KEY');
    const prompt = `Fix this failing SQL query.

Original SQL: ${sql}
Error: ${error}
Schema: ${schema}

Return ONLY the corrected SELECT SQL query:`;
    return this.callAnthropic(prompt, apiKey, baseUrl, model);
  }
}