/**
 * @module @volt-os/model-router
 * Model routing subsystem for VOLT OS.
 *
 * Routes model requests to optimal providers based on cost, latency,
 * capability, and availability. Supports failover, streaming, BYOK,
 * and budget controls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type {
  ModelProviderType,
  ModelProviderConfig,
  ModelConfig,
  ModelRequest,
  ModelResponse,
  ProviderHealth,
  ProviderHealthStatus,
  BudgetConfig,
  BudgetUsage,
  TokenUsage,
  ChatMessage,
  MessageRole,
  RateLimitConfig,
  ScoringWeights,
} from './types.js';

export { ModelRouterEvents } from './types.js';
export type { ModelRouterEventName } from './types.js';

// ---------------------------------------------------------------------------
// Provider Interface & Implementations
// ---------------------------------------------------------------------------
export type { IModelProvider } from './providers/provider.js';
export { OpenAIProvider } from './providers/openai.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { CustomProvider } from './providers/custom.js';

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
export { ModelRouter } from './routing/router.js';
export type { ModelRouterOptions } from './routing/router.js';
export { FailoverManager } from './routing/failover.js';
export type { FailoverOptions } from './routing/failover.js';
export { ProviderScorer, ConfigurableProviderScorer } from './routing/scoring.js';

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------
export { BudgetManager } from './budget/budget.js';

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------
export { StreamHandler } from './streaming/stream.js';

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
export { RouterMetrics } from './metrics.js';
