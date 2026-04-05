// lib/ai/types.ts
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  generateSQL(question: string, schema: string, apiKey?: string, baseUrl?: string): Promise<string>;
  generateExplanation(question: string, result: any[], apiKey?: string, baseUrl?: string): Promise<string>;
  fixSQL(sql: string, error: string, schema: string, apiKey?: string, baseUrl?: string): Promise<string>;
}

export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'lmstudio' | 'ollama';

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}