/**
 * @module @volt-os/model-router/providers/anthropic
 * Anthropic API provider implementation (uses native fetch, no SDK dependency).
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

const logger = pino({ name: 'volt-os:model-router:anthropic' });

/** Anthropic message format. */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Anthropic API request body. */
interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  stream?: boolean;
}

/** Anthropic usage response. */
interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

/** Anthropic API response. */
interface AnthropicResponse {
  id: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  usage: AnthropicUsage;
  stop_reason: string | null;
}

export class AnthropicProvider implements IModelProvider {
  readonly id: string;
  readonly type: ModelProviderType = 'anthropic';
  private readonly config: ModelProviderConfig;
  private consecutiveFailures = 0;
  private totalLatencyMs = 0;
  private requestCount = 0;

  constructor(config: ModelProviderConfig) {
    this.config = config;
    this.id = config.id;
  }

  /** Resolve the best model from the configured list. */
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

  /** Convert generic messages to Anthropic format (system handled separately). */
  private formatMessages(
    request: ModelRequest,
  ): { system?: string; messages: AnthropicMessage[] } {
    let system: string | undefined;
    const messages: AnthropicMessage[] = [];

    for (const m of request.messages) {
      if (m.role === 'system') {
        // Anthropic expects system as a top-level param
        system = system ? `${system}\n\n${m.content}` : m.content;
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }

    return { system, messages };
  }

  async send(request: ModelRequest): Promise<ModelResponse> {
    const model = this.resolveModel(request);
    const baseUrl = this.config.baseUrl ?? 'https://api.anthropic.com/v1';

    const { system, messages } = this.formatMessages(request);

    const body: AnthropicRequestBody = {
      model,
      max_tokens: request.maxTokens ?? 4096,
      messages,
      stream: false,
    };

    if (system) body.system = system;
    if (request.temperature !== undefined) body.temperature = request.temperature;

    const start = performance.now();

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.consecutiveFailures++;
      const errorBody = await response.text();
      logger.error(
        { status: response.status, body: errorBody, providerId: this.id },
        'Anthropic API error',
      );
      throw new Error(
        `Anthropic API error ${response.status}: ${errorBody}`,
      );
    }

    const data: AnthropicResponse = await response.json() as AnthropicResponse;
    const latencyMs = performance.now() - start;

    this.consecutiveFailures = 0;
    this.totalLatencyMs += latencyMs;
    this.requestCount++;

    const inputTokens = data.usage.input_tokens;
    const outputTokens = data.usage.output_tokens;

    const modelConfig = this.config.models.find((m) => m.id === model);
    const costPerInput = modelConfig?.costPerInputToken ?? 0;
    const costPerOutput = modelConfig?.costPerOutputToken ?? 0;
    const costUsd =
      inputTokens * costPerInput + outputTokens * costPerOutput;

    // Concatenate content blocks
    const content = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      id: generateId(),
      requestId: request.id,
      content,
      model: data.model,
      provider: this.id,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
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
