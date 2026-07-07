/**
 * @module @volt-os/model-router/routing/scoring
 * Scores providers against requests using weighted multi-factor analysis.
 */

import type { IModelProvider } from '../providers/provider.js';
import type { ModelRequest, ProviderHealth, ScoringWeights } from '../types.js';

/** Default scoring weights. */
const DEFAULT_WEIGHTS: ScoringWeights = {
  capability: 30,
  cost: 25,
  latency: 20,
  health: 15,
  priority: 10,
};

export class ProviderScorer {
  private readonly weights: ScoringWeights;

  constructor(weights?: Partial<ScoringWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Compute a composite score for a provider given a request and health info.
   * Higher score = better match.
   */
  score(
    provider: IModelProvider,
    request: ModelRequest,
    health: ProviderHealth,
  ): number {
    if (!provider.canHandle(request)) return 0;

    const cap = this.capabilityScore(provider, request);
    const cost = this.costScore(provider, request);
    const lat = this.latencyScore(health);
    const hlth = this.healthScore(health);
    const pr = this.priorityScore(provider, request);

    const totalWeight =
      this.weights.capability +
      this.weights.cost +
      this.weights.latency +
      this.weights.health +
      this.weights.priority;

    const raw =
      (cap * this.weights.capability +
        cost * this.weights.cost +
        lat * this.weights.latency +
        hlth * this.weights.health +
        pr * this.weights.priority) /
      totalWeight;

    // Clamp to [0, 100]
    return Math.max(0, Math.min(100, raw));
  }

  /**
   * Capability match score (0–100).
   * 100 = all requested capabilities satisfied; 0 = none match.
   */
  private capabilityScore(
    provider: IModelProvider,
    request: ModelRequest,
  ): number {
    if (!request.capabilities || request.capabilities.length === 0) {
      return 100; // No specific requirements → full score
    }

    // Count how many models satisfy all requested capabilities
    const config = this.getProviderConfig(provider);
    if (!config) return 0;

    const satisfyingModels = config.models.filter((m) =>
      request.capabilities!.every((c) => m.capabilities.includes(c)),
    );

    if (satisfyingModels.length === 0) return 0;

    // Score by the best matching model's capability coverage
    const bestMatch = satisfyingModels.reduce((best, model) => {
      const coverage =
        request.capabilities!.filter((c) =>
          model.capabilities.includes(c),
        ).length / request.capabilities!.length;
      return coverage > best ? coverage : best;
    }, 0);

    return bestMatch * 100;
  }

  /**
   * Cost score (0–100). Lower cost = higher score.
   * Uses the cheapest model that can handle the request.
   */
  private costScore(
    provider: IModelProvider,
    request: ModelRequest,
  ): number {
    const config = this.getProviderConfig(provider);
    if (!config || config.models.length === 0) return 0;

    // Estimate cost for a 1000-token exchange (input + output)
    const estimatedInput = 1000;
    const estimatedOutput = 500;

    const costs = config.models.map(
      (m) =>
        m.costPerInputToken * estimatedInput +
        m.costPerOutputToken * estimatedOutput,
    );

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    if (maxCost === 0) return 100; // Free models
    if (minCost === maxCost) return 50;

    // Normalize: cheapest gets 100, most expensive gets 0
    const normalized = 1 - (minCost - 0) / (maxCost - 0 + 0.0001);
    return normalized * 100;
  }

  /**
   * Latency score (0–100). Lower average latency = higher score.
   */
  private latencyScore(health: ProviderHealth): number {
    if (health.averageLatencyMs === 0) return 80; // Unknown → moderate score

    // Under 500ms → 100, over 10000ms → 0
    const maxLatency = 10000;
    const minLatency = 0;

    const normalized =
      1 -
      (health.averageLatencyMs - minLatency) /
        (maxLatency - minLatency);

    return Math.max(0, Math.min(100, normalized * 100));
  }

  /**
   * Health score (0–100).
   */
  private healthScore(health: ProviderHealth): number {
    switch (health.status) {
      case 'healthy':
        return 100;
      case 'degraded':
        return 50;
      case 'unhealthy':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Priority score (0–100). Lower priority value = higher score.
   */
  private priorityScore(
    provider: IModelProvider,
    request: ModelRequest,
  ): number {
    const config = this.getProviderConfig(provider);
    if (!config) return 0;

    // Preferred provider gets a big boost
    if (request.preferredProvider === provider.id) return 100;

    // Priority 0 → 100, Priority 100+ → ~0
    const maxPriority = 100;
    const normalized = 1 - config.priority / maxPriority;
    return Math.max(0, Math.min(100, normalized * 100));
  }

  /**
   * Extract the ModelProviderConfig from a provider.
   * Providers store config privately; we read the public metadata.
   * This is a heuristic based on the interface.
   */
  private getProviderConfig(
    provider: IModelProvider,
  ): { models: Array<{ costPerInputToken: number; costPerOutputToken: number; capabilities: string[] }>; priority: number } | null {
    // The provider itself exposes id and type. We can't access private config
    // directly, so we store configs externally. For now, return a minimal
    // proxy based on the provider's canHandle behaviour.
    // In practice the router injects this.
    return null;
  }
}

/**
 * Enhanced scorer that accepts external config for cost/capability scoring.
 */
export class ConfigurableProviderScorer extends ProviderScorer {
  private readonly providerConfigs: Map<
    string,
    {
      models: Array<{
        costPerInputToken: number;
        costPerOutputToken: number;
        capabilities: string[];
      }>;
      priority: number;
    }
  >;

  constructor(
    providerConfigs: Map<
      string,
      {
        models: Array<{
          costPerInputToken: number;
          costPerOutputToken: number;
          capabilities: string[];
        }>;
        priority: number;
      }
    >,
    weights?: Partial<ScoringWeights>,
  ) {
    super(weights);
    this.providerConfigs = providerConfigs;
  }

  /**
   * Capability match score using external config.
   */
  private capabilityScoreWithConfig(
    providerId: string,
    request: ModelRequest,
  ): number {
    if (!request.capabilities || request.capabilities.length === 0) return 100;

    const config = this.providerConfigs.get(providerId);
    if (!config) return 0;

    const satisfying = config.models.filter((m) =>
      request.capabilities!.every((c) => m.capabilities.includes(c)),
    );

    if (satisfying.length === 0) return 0;

    const bestCoverage = satisfying.reduce((best, model) => {
      const coverage =
        request.capabilities!.filter((c) =>
          model.capabilities.includes(c),
        ).length / request.capabilities!.length;
      return coverage > best ? coverage : best;
    }, 0);

    return bestCoverage * 100;
  }

  private costScoreWithConfig(providerId: string): number {
    const config = this.providerConfigs.get(providerId);
    if (!config || config.models.length === 0) return 0;

    const estimatedInput = 1000;
    const estimatedOutput = 500;

    const costs = config.models.map(
      (m) =>
        m.costPerInputToken * estimatedInput +
        m.costPerOutputToken * estimatedOutput,
    );

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    if (maxCost === 0) return 100;
    if (minCost === maxCost) return 50;

    return (1 - minCost / (maxCost + 0.0001)) * 100;
  }

  private priorityScoreWithConfig(
    providerId: string,
    request: ModelRequest,
  ): number {
    const config = this.providerConfigs.get(providerId);
    if (!config) return 0;

    if (request.preferredProvider === providerId) return 100;

    const normalized = 1 - config.priority / 100;
    return Math.max(0, Math.min(100, normalized * 100));
  }

  /**
   * Override the base score method to use external configs.
   */
  overrideScore(
    providerId: string,
    request: ModelRequest,
    health: ProviderHealth,
  ): number {
    const canHandle = this.providerConfigs.has(providerId);
    if (!canHandle) return 0;

    const config = this.providerConfigs.get(providerId);
    const hasMatchingCap =
      !request.capabilities ||
      request.capabilities.length === 0 ||
      config?.models.some((m) =>
        request.capabilities!.every((c) => m.capabilities.includes(c)),
      );

    if (!hasMatchingCap) return 0;

    const cap = this.capabilityScoreWithConfig(providerId, request);
    const cost = this.costScoreWithConfig(providerId);
    const lat = this.latencyScore(health);
    const hlth = this.healthScore(health);
    const pr = this.priorityScoreWithConfig(providerId, request);

    const totalWeight =
      this.weights.capability +
      this.weights.cost +
      this.weights.latency +
      this.weights.health +
      this.weights.priority;

    const raw =
      (cap * this.weights.capability +
        cost * this.weights.cost +
        lat * this.weights.latency +
        hlth * this.weights.health +
        pr * this.weights.priority) /
      totalWeight;

    return Math.max(0, Math.min(100, raw));
  }
}
