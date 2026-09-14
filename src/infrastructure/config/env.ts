import { z } from 'zod';
import {
  MAX_DOCUMENT_PAGES,
  MAX_EXTRACTED_CHARACTERS,
  MAX_UPLOAD_BYTES,
  RATE_LIMIT_PER_MINUTE,
} from '@/security/quotas';

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LLM_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
    GEMINI_API_KEY: z.string().optional(),
    MAX_UPLOAD_BYTES: z.coerce.number().positive().default(MAX_UPLOAD_BYTES),
    MAX_DOCUMENT_PAGES: z.coerce.number().positive().default(MAX_DOCUMENT_PAGES),
    MAX_EXTRACTED_CHARACTERS: z.coerce.number().positive().default(MAX_EXTRACTED_CHARACTERS),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().positive().default(RATE_LIMIT_PER_MINUTE),
    TRUSTED_PROXY: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.LLM_PROVIDER === 'gemini') {
        return !!data.GEMINI_API_KEY && data.GEMINI_API_KEY.trim().length > 0;
      }
      return true;
    },
    {
      message: 'GEMINI_API_KEY is required when LLM_PROVIDER is configured as "gemini".',
      path: ['GEMINI_API_KEY'],
    }
  );

export type Environment = z.infer<typeof EnvironmentSchema>;

let cachedConfig: Environment | null = null;

/**
 * Loads and validates environment configuration.
 * Fails closed on invalid configuration rather than silently returning defaults.
 */
export function getAppConfig(): Environment {
  if (cachedConfig) {
    return cachedConfig;
  }

  const raw = {
    NODE_ENV: process.env.NODE_ENV,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
    MAX_DOCUMENT_PAGES: process.env.MAX_DOCUMENT_PAGES,
    MAX_EXTRACTED_CHARACTERS: process.env.MAX_EXTRACTED_CHARACTERS,
    RATE_LIMIT_PER_MINUTE: process.env.RATE_LIMIT_PER_MINUTE,
    TRUSTED_PROXY: process.env.TRUSTED_PROXY,
  };

  const parsed = EnvironmentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid application configuration: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
    );
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

// Reset helper for unit testing
export function resetAppConfigForTesting(): void {
  cachedConfig = null;
}
