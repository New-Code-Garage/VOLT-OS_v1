/**
 * @module @volt-os/model-router/routing/router
 * Core Model Router — selects the best provider, executes with failover,
 * enforces budgets, and emits events.
 */

import pino from 'pino';
import type { EventBus } from '@volt-os/event-bus';
import type { IModelProvider } from '../providers/provider.js';
import type {
  BudgetConfig,
  BudgetUsage,
  ModelRequest,
  ModelResponse,
  ProviderHealth,
} from '../types.js';
import { ModelRouterEvents } from '../types.js';
import { FailoverManager } from './failover.js';
import { ProviderScorer } from './scoring.js';
import { BudgetManager } from '../budget/budget.js';
import { RouterMetrics } from '../metrics.js';

const logger = pino({ name: 'volt-os:model-router' });

export interface ModelRouterOptions {
  providers: IModelProvider[];
  eventBus: EventBus;
  budget?: BudgetConfig;
  failover?: {
    maxRetries?: number;
    backoffMs?: number;
  };
}

export class ModelRouter {
  private readonly providers: IModelProvider[];
  private readonly eventBus: EventBus;
  private readonly failover: FailoverManager;
  private readonly scorer: ProviderScorer;
  private readonly budget: BudgetManager | null;
  readonly metrics: RouterMetrics;

  constructor(options: ModelRouterOptions) {
    this.providers = options.providers;
    this.eventBus = options.eventBus;
    this.failover = new FailoverManager(options.failover);
    this.scorer = new ProviderScorer();
    this.budget = options.budget ? new BudgetManager(options.budget) : null;
    this.metrics = new RouterMetrics();
  }

  /**
   * Route a request to the best available provider.
   * Respects budget limits and uses failover on errors.
   */
  async route(request: ModelRequest): Promise<ModelResponse> {
    logger.info({ requestId: request.id, agentId: request.agentId }, 'Routing request');

    // 1. Check budget
    const candidates = this.getAvailableProviders();
    if (candidates.length === 0) {
      this.eventBus.emit(ModelRouterEvents.REQUEST_FAILED, {
        requestId: request.id,
        reason: 'No available providers',
      });
      throw new Error('No available providers');
    }

    // 2. Select and sort candidates
    const sorted = this.rankProviders(request, candidates);

    // 3. Check budget against top candidate
    if (this.budget && sorted.length > 0) {
      const budgetCheck = this.budget.checkBudget(request, sorted[0]);
      if (!budgetCheck.allowed) {
        this.eventBus.emit(ModelRouterEvents.BUDGET_EXCEEDED, {
          requestId: request.id,
          reason: budgetCheck.reason,
        });
        throw new Error(`Budget exceeded: ${budgetCheck.reason}`);
      }
    }

    this.eventBus.emit(ModelRouterEvents.REQUEST_ROUTED, {
      requestId: request.id,
      candidates: sorted.map((p) => p.id),
    });

    // 4. Execute with failover
    return this.routeWithFailover(request, sorted);
  }

  /**
   * Route with automatic failover across candidate providers.
   */
  private async routeWithFailover(
    request: ModelRequest,
    candidates: IModelProvider[],
  ): Promise<ModelResponse> {
    if (candidates.length === 0) {
      throw new Error('No providers available for failover');
    }

    let lastProviderId = candidates[0]?.id;

    try {
      const response = await this.failover.executeWithFailover(
        candidates,
        async (provider) => {
          lastProviderId = provider.id;
          const result = await provider.send(request);
          return result;
        },
      );

      // Record success
      this.metrics.recordRequest(
        response.provider,
        response.latencyMs,
        response.usage.totalTokens,
        response.costUsd,
      );

      // Record budget usage
      if (this.budget) {
        this.budget.recordUsage(response.costUsd, response.usage.totalTokens);
      }

      this.eventBus.emit(ModelRouterEvents.REQUEST_COMPLETED, {
        requestId: request.id,
        providerId: response.provider,
        latencyMs: response.latencyMs,
        costUsd: response.costUsd,
      });

      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      this.metrics.recordError(lastProviderId ?? 'unknown', error.message);

      this.eventBus.emit(ModelRouterEvents.REQUEST_FAILED, {
        requestId: request.id,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Select the best provider for a request (non-executing).
   */
  selectProvider(request: ModelRequest): IModelProvider | null {
    const candidates = this.getAvailableProviders();
    const ranked = this.rankProviders(request, candidates);
    return ranked[0] ?? null;
  }

  /**
   * Score a provider for a given request.
   */
  scoreProvider(provider: IModelProvider, request: ModelRequest): number {
    const health = this.getProviderHealthFor(provider.id);
    return this.scorer.score(provider, request, health);
  }

  /**
   * Get all providers that are enabled and can handle the request.
   */
  getAvailableProviders(): IModelProvider[] {
    return this.providers.filter((p) => p.canHandle({
      id: '',
      agentId: '',
      messages: [],
    }) || this.isProviderEnabled(p));
  }

  /**
   * Get health information for all providers.
   */
  async getProviderHealth(): Promise<ProviderHealth[]> {
    const healthChecks = this.providers.map((p) => p.healthCheck());
    return Promise.all(healthChecks);
  }

  /**
   * Get current budget usage.
   */
  getBudgetStatus(): BudgetUsage {
    if (this.budget) {
      return this.budget.getDailyUsage();
    }
    return { costUsd: 0, tokens: 0, requestCount: 0 };
  }

  /**
   * Rank providers by score for a given request.
   */
  private rankProviders(
    request: ModelRequest,
    candidates: IModelProvider[],
  ): IModelProvider[] {
    return [...candidates]
      .map((p) => ({
        provider: p,
        score: this.scoreProvider(p, request),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.provider);
  }

  private isProviderEnabled(provider: IModelProvider): boolean {
    // Check health status — unhealthy providers are excluded
    const health = this.failover.getHealth(provider.id);
    if (health && health.status === 'unhealthy') return false;
    return true;
  }

  private getProviderHealthFor(providerId: string): ProviderHealth {
    const health = this.failover.getHealth(providerId);
    if (health) return health;

    return {
      providerId,
      status: 'healthy',
      lastCheck: new Date(),
      consecutiveFailures: 0,
      averageLatencyMs: 0,
    };
  }
}
