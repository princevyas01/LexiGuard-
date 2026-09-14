import { GoogleGenerativeAI } from '@google/generative-ai';
import { SECURITY_QUOTAS } from '@/security/quotas';
import {
  LLMProvider,
  StructuredGenerationRequest,
  TextGenerationRequest,
} from './provider-interface';

export class GeminiProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'GeminiProviderError';
  }
}

/**
 * Google Gemini Provider Adapter.
 * Implements structured JSON generation with bounded retries and timeout guards.
 */
export class GeminiLLMProvider implements LLMProvider {
  public readonly providerName = 'gemini';
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName = 'gemini-3.6-flash') {
    if (!apiKey) {
      throw new GeminiProviderError('GEMINI_API_KEY is required for GeminiLLMProvider');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  public async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<T> {
    const maxRetries = request.maxRetries ?? 1;
    let attempts = 0;
    let lastError: Error | null = null;

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: request.temperature ?? 0.1,
        maxOutputTokens: SECURITY_QUOTAS.MAX_OUTPUT_TOKENS,
      },
    });

    const fullPrompt = `${request.systemPrompt}\n\nStrictly return valid JSON adhering to requirements.\n\n${request.userPrompt}`;

    while (attempts <= maxRetries) {
      attempts++;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new GeminiProviderError('Gemini request timed out.')),
            SECURITY_QUOTAS.OPERATION_TIMEOUT_MS
          );
        });

        const resultPromise = model.generateContent(fullPrompt);
        const response = await Promise.race([resultPromise, timeoutPromise]);
        const rawText = response.response.text().trim();
        const jsonText = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        // Parse and validate with Zod
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(jsonText);
        } catch (jsonErr) {
          lastError = new GeminiProviderError('Model did not return valid JSON syntax');
          continue; // Retry if JSON syntax was malformed
        }

        const validation = request.schema.safeParse(parsedJson);
        if (validation.success) {
          return validation.data;
        } else {
          lastError = new GeminiProviderError(
            `Output schema validation failed: ${validation.error.message}`
          );
          // Do not retry deterministic schema errors if prompt cannot satisfy schema
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new GeminiProviderError(String(err));
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
      }
    }

    throw new GeminiProviderError(
      `Failed to generate structured data from Gemini after ${attempts} attempts: ${lastError?.message}`
    );
  }

  public async generateText(request: TextGenerationRequest): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: SECURITY_QUOTAS.MAX_OUTPUT_TOKENS,
      },
    });

    const fullPrompt = `${request.systemPrompt}\n\n${request.userPrompt}`;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const resultPromise = model.generateContent(fullPrompt);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new GeminiProviderError('Gemini text request timed out.')),
          SECURITY_QUOTAS.OPERATION_TIMEOUT_MS
        );
      });
      const response = await Promise.race([resultPromise, timeoutPromise]);
      return response.response.text();
    } catch (err) {
      throw new GeminiProviderError(
        `Gemini text generation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}
