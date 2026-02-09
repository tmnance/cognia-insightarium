/**
 * LLM Service - Generic OpenAI-compatible chat completions client
 *
 * Works with OpenRouter, Ollama, Groq, OpenAI, and any provider that supports
 * the OpenAI chat completions API format.
 */

import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Check if the LLM is properly configured for direct API calls
 */
export function isLLMConfigured(): boolean {
  const { llm } = config;
  if (!llm.enabled) return false;
  if (!llm.apiBaseUrl?.trim()) return false;
  if (!llm.model?.trim()) return false;
  // Ollama and some local providers don't require an API key
  if (llm.apiBaseUrl.includes('localhost') || llm.apiBaseUrl.includes('127.0.0.1')) {
    return true;
  }
  return !!llm.apiKey?.trim();
}

/**
 * Send a chat completion request to the configured LLM
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<string> {
  const { llm } = config;
  if (!isLLMConfigured()) {
    throw new Error(
      'LLM is not configured. Set LLM_ENABLED=true, LLM_API_BASE_URL, LLM_MODEL, and LLM_API_KEY in .env'
    );
  }

  const url = `${llm.apiBaseUrl.replace(/\/$/, '')}/chat/completions`;
  const timeoutMs = options?.timeoutMs ?? 120_000;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (llm.apiKey) {
    headers['Authorization'] = `Bearer ${llm.apiKey}`;
  }

  const body = {
    model: llm.model,
    messages,
    max_tokens: options?.maxTokens ?? llm.maxTokens,
    temperature: options?.temperature ?? llm.temperature,
  };

  logger.info('Calling LLM chat completion', {
    model: llm.model,
    messageCount: messages.length,
    timeoutMs,
  });

  try {
    const response = await axios.post(url, body, {
      headers,
      timeout: timeoutMs,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (content == null) {
      throw new Error(
        `Unexpected LLM response format: ${JSON.stringify(response.data).slice(0, 200)}`
      );
    }

    return String(content).trim();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;
      const message =
        typeof data?.error?.message === 'string'
          ? data.error.message
          : typeof data?.error === 'string'
            ? data.error
            : error.message;
      logger.error('LLM API error', {
        status,
        message,
        url: error.config?.url,
      });
      throw new Error(`LLM API error: ${message}`);
    }
    throw error;
  }
}
