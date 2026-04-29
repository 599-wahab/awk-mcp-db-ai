// lib/ai/providers/gemini.ts
import { AIProvider } from '../types';

const GEMINI_MODELS = {
  '3-flash-preview': 'gemini-3-flash-preview',
  '2.0-flash-exp': 'gemini-2.0-flash-exp',
  '1.0-pro': 'gemini-1.0-pro',
};


export class GeminiProvider implements AIProvider {
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
      if (response.status === 404) throw new Error('MODEL_NOT_FOUND');
      if (response.status === 429) throw new Error('QUOTA_EXCEEDED');
      if (response.status === 403) throw new Error('INVALID_KEY');
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async generateSQL(
    question: string,
    schema: string,
    apiKey?: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    if (!apiKey) throw new Error('NO_KEY');

    const prompt = `You are a PostgreSQL expert. Convert the user question into a valid PostgreSQL SELECT query.

DATABASE SCHEMA:
${schema}

USER QUESTION: ${question}

STRICT RULES — follow all of them:
1. Return ONLY a raw SQL query. No markdown, no backticks, no explanation, no comments.
2. ONLY write SELECT statements. Never write INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE.
3. If the question is about tasks, look for a table named "tasks" or similar. Use columns that exist in the schema.
4. If a column or table does not exist in the schema, do NOT invent it. Use only what is in the schema above.
5. Always add LIMIT 100 unless the question asks for a count/sum/aggregate.
6. For boolean columns like "completed", "is_done", "status" — use proper boolean or text comparison based on the schema column type.
7. For "pending" or "remaining" tasks — filter where completed = false OR status NOT IN ('done','completed','finished') depending on schema.
8. Never use syntax like "tasks left" as a column — translate intent into real column filters.
9. Use simple, clean SQL. Avoid CTEs or subqueries unless absolutely necessary.
10. If you cannot write a valid SELECT query for this question, return exactly: SELECT 'UNABLE_TO_QUERY' AS error

SQL query:`;

    return this.callGemini(prompt, apiKey, model);
  }

  async generateExplanation(
    question: string,
    result: any[],
    apiKey?: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    if (!apiKey) return `Found ${result.length} result(s).`;

    // Detect language from question
    const isUrdu =
      /[\u0600-\u06FF]/.test(question) ||
      /\b(kya|hai|hain|aap|mujhe|batao|dikhao|kitne|kitni|total|salary|order|sale|باقی|کام|مصنوع)\b/i.test(question);

    const langInstruction = isUrdu
      ? 'Respond in Urdu language only. Use simple Urdu words.'
      : 'Respond in English only.';

    const prompt = `${langInstruction}

Explain these database query results to the user in 1-3 simple sentences. Be direct and helpful.

User asked: ${question}
Query results (sample): ${JSON.stringify(result.slice(0, 10))}
Total rows returned: ${result.length}

${isUrdu ? 'جواب اردو میں دیں:' : 'Answer:'}`;

    return this.callGemini(prompt, apiKey, model);
  }

  async fixSQL(
    sql: string,
    error: string,
    schema: string,
    apiKey?: string,
    baseUrl?: string,
    model?: string
  ): Promise<string> {
    if (!apiKey) throw new Error('NO_KEY');

    const prompt = `You are a PostgreSQL expert. Fix this broken SQL query.

SCHEMA:
${schema}

BROKEN SQL:
${sql}

ERROR MESSAGE:
${error}

RULES:
1. Return ONLY the corrected SQL query. No explanation, no markdown, no backticks.
2. Must be a SELECT statement only.
3. Only use tables and columns that exist in the schema above.
4. If the original query concept is impossible with this schema, return: SELECT 'UNABLE_TO_QUERY' AS error

FIXED SQL:`;

    return this.callGemini(prompt, apiKey, model);
  }
}