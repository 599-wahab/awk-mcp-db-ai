// lib/ai/providers/lmstudio.ts
import { AIProvider } from '../types';

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
    return this.callLMStudio(prompt, baseUrl, model);
  }

  async generateExplanation(question: string, result: any[], apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    const prompt = `Explain these query results in simple terms.

Question: ${question}
Results (first 5 rows): ${JSON.stringify(result.slice(0, 5))}

Provide a brief, helpful explanation in 1-2 sentences:`;
    return this.callLMStudio(prompt, baseUrl, model);
  }

  async fixSQL(sql: string, error: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string> {
    const prompt = `Fix this failing SQL query.

Original SQL: ${sql}
Error: ${error}
Schema: ${schema}

Return ONLY the corrected SELECT SQL query:`;
    return this.callLMStudio(prompt, baseUrl, model);
  }
}