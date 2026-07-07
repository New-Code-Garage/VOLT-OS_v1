/**
 * @module @volt-os/model-router/providers/custom
 * Generic BYOK (Bring Your Own Key) provider for any OpenAI-compatible endpoint.
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

const logger = pino({ name: 'volt-os:model-router:custom' });

/** Generic chat completion request body. */
interface GenericChatBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

/** Generic usage object. */
interface GenericUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** Generic chat completion response. */
interface GenericChatResponse {
  id: string;
  choices: Array<{
    message?: { role: string; content: string };
    finish_reason: string | null;
  }>;
  usage?: GenericUsage;
  model: string;
}

export class CustomProvider implements IModelProvider {
  readonly id: string;
  readonly type: ModelProviderType;
  private readonly config: ModelProviderConfig & { baseUrl: string };
  private consecutiveFailures = 0;
  private totalLatencyMs = 0;
  private requestCount = 0;

  constructor(config: ModelProviderConfig & { baseUrl: string }) {
    this.config = config;
    this.id = config.id;
    this.type = config.type;
  }

  /** Resolve the best model. */
  private resolveModel(request: ModelRequest): string {
    if (this.config.models.length === 0) {
      throw new Error(`No models configured for provider ${this.id}`);
    }

    if (request.capabilities && request.capabilities.length > 0) {
      const match = this.config.models.find((m) =>
        request.capabilities!.every((c) => m.capabilities.includes(c)),
      );
      if (match) return match.id;
    }

    return this.config.models[0].id;
  }

  async send(request: ModelRequest): Promise<ModelResponse> {
    const model = this.resolveModel(request);
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');

    const body: GenericChatBody = {
      model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
    };

    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.temperature !== undefined) body.temperature = request.temperature;

    const start = performance.now();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.consecutiveFailures++;
      const errorBody = await response.text();
      logger.error(
        { status: response.status, body: errorBody, providerId: this.id },
        'Custom provider API error',
      );
      throw new Error(
        `Custom provider ${this.id} error ${response.status}: ${errorBody}`,
      );
    }

    const data: GenericChatResponse = await response.json() as GenericChatResponse;
    const latencyMs = performance.now() - start;

    this.consecutiveFailures = 0;
    this.totalLatencyMs += latencyMs;
    this.requestCount++;

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;

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
