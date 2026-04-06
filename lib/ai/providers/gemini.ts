// lib/ai/providers/gemini.ts
import { AIProvider } from '../types';

// Updated model names to currently supported versions
const GEMINI_MODELS = {
  '3-flash-preview': 'gemini-3-flash-preview',
  '2.0-flash-exp': 'gemini-2.0-flash-exp',
  '1.0-pro': 'gemini-1.0-pro',
};

export class GeminiProvider implements AIProvider {
  // Set active model as default
  private defaultModel = 'gemini-3-flash-preview';

  private async callGemini(
    prompt: string,
    apiKey: string,
    model?: string
  ): Promise<string> {
    const modelName = model || this.defaultModel;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1, 
          maxOutputTokens: 2000,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API Error:', response.status, error);
      
      if (response.status === 404) {
        throw new Error(`MODEL_NOT_FOUND: Model ${modelName} not available. Try: ${Object.keys(GEMINI_MODELS).join(', ')}`);
      }
      if (response.status === 429) throw new Error('QUOTA_EXCEEDED');
      if (response.status === 403) throw new Error('INVALID_KEY');
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateSQL(question: string, schema: string, apiKey?: string, model?: string): Promise<string> {
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
    return this.callGemini(prompt, apiKey, model);
  }

  async generateExplanation(question: string, result: any[], apiKey?: string, model?: string): Promise<string> {
    if (!apiKey) return `Found ${result.length} result(s).`;
    const prompt = `Explain these query results in simple terms.

Question: ${question}
Results (first 5 rows): ${JSON.stringify(result.slice(0, 5))}

Provide a brief, helpful explanation in 1-2 sentences:`;
    return this.callGemini(prompt, apiKey, model);
  }

  async fixSQL(sql: string, error: string, schema: string, apiKey?: string, model?: string): Promise<string> {
    if (!apiKey) throw new Error('NO_KEY');
    const prompt = `Fix this failing SQL query.

Original SQL: ${sql}
Error: ${error}
Schema: ${schema}

Return ONLY the corrected SELECT SQL query:`;
    return this.callGemini(prompt, apiKey, model);
  }
}