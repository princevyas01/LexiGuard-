import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiLLMProvider } from '@/infrastructure/llm/gemini-provider';
import { SECURITY_QUOTAS } from '@/security/quotas';

type GenerativeModelMock = ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

describe('Gemini Provider Timeout & Timer Cleanup (Security Fix #2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. successful structured generation leaves zero pending timers', async () => {
    const mockModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({ message: 'hello world' }),
        },
      }),
    };

    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue(
      mockModel as unknown as GenerativeModelMock
    );

    const provider = new GeminiLLMProvider('test-api-key');
    const resultPromise = provider.generateStructured({
      systemPrompt: 'System',
      userPrompt: 'User',
      schema: z.object({ message: z.string() }),
    });

    const result = await resultPromise;
    expect(result).toEqual({ message: 'hello world' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('2. structured timeout cleans its timer and throws GeminiProviderError', async () => {
    const mockModel = {
      generateContent: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
    };

    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue(
      mockModel as unknown as GenerativeModelMock
    );

    const provider = new GeminiLLMProvider('test-api-key');
    const resultPromise = provider.generateStructured({
      systemPrompt: 'System',
      userPrompt: 'User',
      schema: z.object({ value: z.number() }),
      maxRetries: 0,
    });

    // Advance time past operation timeout
    vi.advanceTimersByTime(SECURITY_QUOTAS.OPERATION_TIMEOUT_MS + 100);

    await expect(resultPromise).rejects.toThrow(/timed out/i);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('3. structured retry cleans the previous attempt timer', async () => {
    let callCount = 0;
    const mockModel = {
      generateContent: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            response: {
              text: () => 'INVALID JSON SYNTAX',
            },
          };
        }
        return {
          response: {
            text: () => JSON.stringify({ status: 'ok' }),
          },
        };
      }),
    };

    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue(
      mockModel as unknown as GenerativeModelMock
    );

    const provider = new GeminiLLMProvider('test-api-key');
    const resultPromise = provider.generateStructured({
      systemPrompt: 'System',
      userPrompt: 'User',
      schema: z.object({ status: z.string() }),
      maxRetries: 1,
    });

    const result = await resultPromise;
    expect(result).toEqual({ status: 'ok' });
    expect(callCount).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('4. final structured failure leaves zero pending timers', async () => {
    const mockModel = {
      generateContent: vi.fn().mockRejectedValue(new Error('Network disconnected')),
    };

    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue(
      mockModel as unknown as GenerativeModelMock
    );

    const provider = new GeminiLLMProvider('test-api-key');
    const resultPromise = provider.generateStructured({
      systemPrompt: 'System',
      userPrompt: 'User',
      schema: z.object({ test: z.boolean() }),
      maxRetries: 1,
    });

    await expect(resultPromise).rejects.toThrow(/Network disconnected/i);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('5. successful text generation leaves zero pending timers', async () => {
    const mockModel = {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => 'Plain text answer from LLM',
        },
      }),
    };

    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue(
      mockModel as unknown as GenerativeModelMock
    );

    const provider = new GeminiLLMProvider('test-api-key');
    const resultPromise = provider.generateText({
      systemPrompt: 'System',
      userPrompt: 'User',
    });

    const text = await resultPromise;
    expect(text).toBe('Plain text answer from LLM');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('6. text timeout cleans its timer and throws GeminiProviderError', async () => {
    const mockModel = {
      generateContent: vi.fn().mockImplementation(() => new Promise(() => {})), // Hangs
    };

    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue(
      mockModel as unknown as GenerativeModelMock
    );

    const provider = new GeminiLLMProvider('test-api-key');
    const resultPromise = provider.generateText({
      systemPrompt: 'System',
      userPrompt: 'User',
    });

    vi.advanceTimersByTime(SECURITY_QUOTAS.OPERATION_TIMEOUT_MS + 100);

    await expect(resultPromise).rejects.toThrow(/timed out/i);
    expect(vi.getTimerCount()).toBe(0);
  });
});
