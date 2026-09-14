import { getAppConfig } from '../config/env';
import { GeminiLLMProvider } from './gemini-provider';
import { MockLLMProvider } from './mock-provider';
import { LLMProvider } from './provider-interface';

let currentProvider: LLMProvider | null = null;

/**
 * Resolves the configured LLMProvider instance.
 * Defaults to MockLLMProvider if no external keys are present or in test environment.
 */
export function getLLMProvider(): LLMProvider {
  if (currentProvider) {
    return currentProvider;
  }

  const config = getAppConfig();

  if (config.LLM_PROVIDER === 'gemini' && config.GEMINI_API_KEY) {
    currentProvider = new GeminiLLMProvider(config.GEMINI_API_KEY);
    return currentProvider;
  }

  // Default to zero-config MockLLMProvider
  currentProvider = new MockLLMProvider();
  return currentProvider;
}

/**
 * Resets or overrides active provider (useful for testing or switching modes).
 */
export function setLLMProvider(provider: LLMProvider | null): void {
  currentProvider = provider;
}
