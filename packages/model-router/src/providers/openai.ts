/**
 * @module @volt-os/model-router/providers/openai
 * OpenAI API provider implementation (uses native fetch, no SDK dependency).
 */

import pino from 'pino';
import type { IModelProvider } from './provider.js';
import type {
  ModelProviderConfig,
  ModelProviderType,
  ModelRequest,
  ModelResponse,
  ProviderHealth,
} from '../types.js';
import { generateId } from '@volt-os/shared';

const logger = pino({ name: 'volt-os:model-router:openai' });

/** Chat message shape expected by the OpenAI API. */
interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** OpenAI chat completion request body. */
interface OpenAIChatBody {
  model: string;
  messages: OpenAIChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

/** OpenAI usage object. */
interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** OpenAI chat completion response. */
interface OpenAIChatResponse {
  id: string;
  choices: Array<{
    message?: { role: string; content: string };
    delta?: { content: string };
    finish_reason: string | null;
  }>;
  usage?: OpenAIUsage;
  model: string;
}

export class OpenAIProvider implements IModelProvider {
  readonly id: string;
  readonly type: ModelProviderType = 'openai';
  private readonly config: ModelProviderConfig;
  private consecutiveFailures = 0;
  private totalLatencyMs = 0;
  private requestCount = 0;

  constructor(config: ModelProviderConfig) {
    this.config = config;
    this.id = config.id;
  }

  /** Determine the best model for a request. */
  private resolveModel(request: ModelRequest): string {
    if (this.config.models.length === 0) {
      throw new Error(`No models configured for provider ${this.id}`);
    }

    // If capabilities are requested, try to match
    if (request.capabilities && request.capabilities.length > 0) {
      const match = this.config.models.find((m) =>
        request.capabilities!.every((c) => m.capabilities.includes(c)),
      );
      if (match) return match.id;
    }

    // Fall back to first available model
    return this.config.models[0].id;
  }

  /** Convert generic messages to OpenAI format. */
  private formatMessages(
    request: ModelRequest,
  ): OpenAIChatMessage[] {
    return request.messages.map((m) => ({ role: m.role, content: m.content }));
  }

  async send(request: ModelRequest): Promise<ModelResponse> {
    const model = this.resolveModel(request);
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';

    const body: OpenAIChatBody = {
      model,
      messages: this.formatMessages(request),
      stream: false,
    };

    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.temperature !== undefined) body.temperature = request.temperature;

    const start = performance.now();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey ?? ''}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.consecutiveFailures++;
      const errorBody = await response.text();
      logger.error(
        { status: response.status, body: errorBody, providerId: this.id },
        'OpenAI API error',
      );
      throw new Error(
        `OpenAI API error ${response.status}: ${errorBody}`,
      );
    }

    const data: OpenAIChatResponse = await response.json() as OpenAIChatResponse;
    const latencyMs = performance.now() - start;

    this.consecutiveFailures = 0;
    this.totalLatencyMs += latencyMs;
    this.requestCount++;

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;

    // Find cost info from config
    const modelConfig = this.config.models.find((m) => m.id === model);
    const costPerInput = modelConfig?.costPerInputToken ?? 0;
    const costPerOutput = modelConfig?.costPerOutputToken ?? 0;
    const costUsd =
      promptTokens * costPerInput + completionTokens * costPerOutput;

    const content = data.choices[0]?.message?.content ?? '';

    return {
      id: generateId(),
      requestId: request.id,
      content,
      model: data.model,
      provider: this.id,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      latencyMs,
      costUsd,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const status: ProviderHealth['status'] =
      this.consecutiveFailures === 0
        ? 'healthy'
        : this.consecutiveFailures < 3
          ? 'degraded'
          : 'unhealthy';

    return {
      providerId: this.id,
      status,
      lastCheck: new Date(),
      consecutiveFailures: this.consecutiveFailures,
      averageLatencyMs:
        this.requestCount > 0 ? this.totalLatencyMs / this.requestCount : 0,
    };
  }

  canHandle(request: ModelRequest): boolean {
    if (!this.config.enabled) return false;
    if (this.config.models.length === 0) return false;
    if (!request.capabilities || request.capabilities.length === 0) return true;

    return this.config.models.some((m) =>
      request.capabilities!.every((c) => m.capabilities.includes(c)),
    );
  }
}
