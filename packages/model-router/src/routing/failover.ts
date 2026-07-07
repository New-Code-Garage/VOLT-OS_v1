/**
 * @module @volt-os/model-router/routing/failover
 * Manages provider failover with exponential backoff.
 */

import pino from 'pino';
import type { IModelProvider } from '../providers/provider.js';
import type { ProviderHealth, ProviderHealthStatus } from '../types.js';

const logger = pino({ name: 'volt-os:model-router:failover' });

export interface FailoverOptions {
  maxRetries?: number;
  backoffMs?: number;
}

export class FailoverManager {
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly healthMap = new Map<string, ProviderHealth>();

  constructor(options: FailoverOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseBackoffMs = options.backoffMs ?? 1000;
  }

  /**
   * Execute an operation with failover across the ordered provider list.
   * Tries each provider up to `maxRetries` total attempts across all providers.
   */
  async executeWithFailover<T>(
    providers: IModelProvider[],
    fn: (provider: IModelProvider) => Promise<T>,
  ): Promise<T> {
    if (providers.length === 0) {
      throw new Error('No providers available for failover');
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const providerIndex = attempt % providers.length;
      const provider = providers[providerIndex];

      // Skip unhealthy providers
      const health = this.healthMap.get(provider.id);
      if (health && health.status === 'unhealthy') {
        logger.warn(
          { providerId: provider.id, attempt },
          'Skipping unhealthy provider',
        );
        continue;
      }

      try {
        const result = await fn(provider);
        this.markHealthy(provider.id);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        this.markUnhealthy(provider.id);

        logger.warn(
          { providerId: provider.id, attempt, error: error.message },
          'Provider failed, will retry',
        );

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries - 1) {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('All providers failed');
  }

  /** Mark a provider as unhealthy. */
  markUnhealthy(providerId: string): void {
    const existing = this.healthMap.get(providerId);
    const failures = (existing?.consecutiveFailures ?? 0) + 1;

    const status: ProviderHealthStatus =
      failures >= 3 ? 'unhealthy' : 'degraded';

    this.healthMap.set(providerId, {
      providerId,
      status,
      lastCheck: new Date(),
      consecutiveFailures: failures,
      averageLatencyMs: existing?.averageLatencyMs ?? 0,
    });

    logger.warn(
      { providerId, failures, status },
      'Provider marked unhealthy',
    );
  }

  /** Mark a provider as healthy (reset failure count). */
  markHealthy(providerId: string): void {
    this.healthMap.set(providerId, {
      providerId,
      status: 'healthy',
      lastCheck: new Date(),
      consecutiveFailures: 0,
      averageLatencyMs: this.healthMap.get(providerId)?.averageLatencyMs ?? 0,
    });

    logger.info({ providerId }, 'Provider marked healthy');
  }

  /** Calculate retry delay with exponential backoff. */
  getRetryDelay(attempt: number): number {
    return this.baseBackoffMs * Math.pow(2, attempt);
  }

  /** Get the current health of a provider. */
  getHealth(providerId: string): ProviderHealth | undefined {
    return this.healthMap.get(providerId);
  }

  /** Get all tracked health entries. */
  getAllHealth(): ProviderHealth[] {
    return Array.from(this.healthMap.values());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
