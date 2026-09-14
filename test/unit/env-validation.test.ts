import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAppConfig, resetAppConfigForTesting } from '@/infrastructure/config/env';

describe('Environment Configuration (Fail-Closed Validation)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetAppConfigForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetAppConfigForTesting();
  });

  it('successfully loads default mock configuration', () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.GEMINI_API_KEY;

    const config = getAppConfig();
    expect(config.LLM_PROVIDER).toBe('mock');
  });

  it('fails closed when LLM_PROVIDER is gemini but GEMINI_API_KEY is missing', () => {
    process.env.LLM_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;

    expect(() => getAppConfig()).toThrow(/GEMINI_API_KEY is required/);
  });

  it('fails closed when invalid provider is supplied', () => {
    process.env.LLM_PROVIDER = 'unsupported-provider';

    expect(() => getAppConfig()).toThrow(/Invalid application configuration/);
  });
});
