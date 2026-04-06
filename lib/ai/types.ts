// lib/ai/types.ts
export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'lmstudio' | 'ollama';

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface AIProvider {
  generateSQL(question: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string>;
  generateExplanation(question: string, result: any[], apiKey?: string, baseUrl?: string, model?: string): Promise<string>;
  fixSQL(sql: string, error: string, schema: string, apiKey?: string, baseUrl?: string, model?: string): Promise<string>;
}