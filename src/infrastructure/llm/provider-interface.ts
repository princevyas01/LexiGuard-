import { z } from 'zod';

export interface StructuredGenerationRequest<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  temperature?: number;
  maxRetries?: number;
}

export interface TextGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface LLMProvider {
  readonly providerName: string;
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T>;
  generateText(request: TextGenerationRequest): Promise<string>;
}
