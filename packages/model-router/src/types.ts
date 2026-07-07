/**
 * @module @volt-os/model-router/types
 * Core type definitions for the Model Router subsystem.
 */

// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

/** Supported model provider backends. */
export type ModelProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'mistral'
  | 'llama'
  | 'custom'
  | 'local';

/** Rate-limit configuration for a provider. */
export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

/** Configuration for a single model within a provider. */
export interface ModelConfig {
  id: string;
  name: string;
  capabilities: string[];
  maxContextTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  supportsStreaming: boolean;
}

/** Full provider configuration including credentials and models. */
export interface ModelProviderConfig {
  id: string;
  type: ModelProviderType;
  name: string;
  enabled: boolean;
  /** Lower value = preferred. */
  priority: number;
  apiKey?: string;
  baseUrl?: string;
  models: ModelConfig[];
  rateLimits: RateLimitConfig;
}

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

/** Role for a single chat message. */
export type MessageRole = 'system' | 'user' | 'assistant';

/** A single chat message. */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/** An incoming model request from an agent. */
export interface ModelRequest {
  id: string;
  agentId: string;
  messages: ChatMessage[];
  capabilities?: string[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  preferredProvider?: string;
}

/** Token usage details. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Response returned by a provider after processing a request. */
export interface ModelResponse {
  id: string;
  requestId: string;
  content: string;
  model: string;
  provider: string;
  usage: TokenUsage;
  latencyMs: number;
  costUsd: number;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/** Health status of a provider. */
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Runtime health information for a provider. */
export interface ProviderHealth {
  providerId: string;
  status: ProviderHealthStatus;
  lastCheck: Date;
  consecutiveFailures: number;
  averageLatencyMs: number;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/** Budget constraints enforced by the router. */
export interface BudgetConfig {
  maxCostPerRequest?: number;
  maxCostPerDay?: number;
  maxTokensPerDay?: number;
}

/** Current budget usage snapshot. */
export interface BudgetUsage {
  costUsd: number;
  tokens: number;
  requestCount: number;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Weighted factors for provider scoring. */
export interface ScoringWeights {
  capability: number;
  cost: number;
  latency: number;
  health: number;
  priority: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Event names emitted by the model router. */
export const ModelRouterEvents = {
  REQUEST_ROUTED: 'model-router:request-routed',
  REQUEST_COMPLETED: 'model-router:request-completed',
  REQUEST_FAILED: 'model-router:request-failed',
  FAILOVER_TRIGGERED: 'model-router:failover-triggered',
  PROVIDER_UNHEALTHY: 'model-router:provider-unhealthy',
  PROVIDER_HEALTHY: 'model-router:provider-healthy',
  BUDGET_EXCEEDED: 'model-router:budget-exceeded',
  STREAM_CHUNK: 'model-router:stream-chunk',
  STREAM_COMPLETED: 'model-router:stream-completed',
} as const;

export type ModelRouterEventName =
  (typeof ModelRouterEvents)[keyof typeof ModelRouterEvents];
