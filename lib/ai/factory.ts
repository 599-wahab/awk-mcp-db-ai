// lib/ai/factory.ts
import { AIProvider, AIProviderType, AIProviderConfig } from './types';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { LMStudioProvider } from './providers/lmstudio';
import { OllamaProvider } from './providers/ollama';

export class AIProviderFactory {
  static createProvider(config: AIProviderConfig): AIProvider {
    switch (config.type) {
      case 'gemini':
        return new GeminiProvider();
      case 'openai':
        return new OpenAIProvider();
      case 'anthropic':
        return new AnthropicProvider();
      case 'lmstudio':
        return new LMStudioProvider();
      case 'ollama':
        return new OllamaProvider();
      default:
        throw new Error(`Unsupported AI provider: ${config.type}`);
    }
  }

  static getDefaultModel(provider: AIProviderType): string {
    switch (provider) {
      case 'gemini':
        // Updated default model for fallback
        return 'gemini-3-flash-preview';
      case 'openai':
        return 'gpt-3.5-turbo';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      case 'lmstudio':
        return 'local-model';
      case 'ollama':
        return 'llama2';
    }
  }
}