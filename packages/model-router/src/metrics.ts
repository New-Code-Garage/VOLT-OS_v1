/**
 * @module @volt-os/model-router/metrics
 * Router metrics collection and reporting.
 */

import pino from 'pino';

const logger = pino({ name: 'volt-os:model-router:metrics' });

interface ProviderMetric {
  requests: number;
  totalLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  errors: number;
}

interface FailoverRecord {
  from: string;
  to: string;
  count: number;
}

export class RouterMetrics {
  private readonly providerMetrics = new Map<string, ProviderMetric>();
  private readonly failoverRecords: FailoverRecord[] = [];
  private totalRequests = 0;
  private totalFailovers = 0;
  private totalErrors = 0;

  /**
   * Record a successful request to a provider.
   */
  recordRequest(
    providerId: string,
    latencyMs: number,
    tokens: number,
    costUsd: number,
  ): void {
    this.totalRequests++;

    const existing = this.providerMetrics.get(providerId) ?? {
      requests: 0,
      totalLatencyMs: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      errors: 0,
    };

    existing.requests++;
    existing.totalLatencyMs += latencyMs;
    existing.totalTokens += tokens;
    existing.totalCostUsd += costUsd;

    this.providerMetrics.set(providerId, existing);

    logger.debug(
      { providerId, latencyMs, tokens, costUsd },
      'Request recorded',
    );
  }

  /**
   * Record a failover event.
   */
  recordFailover(fromProvider: string, toProvider: string): void {
    this.totalFailovers++;

    const existing = this.failoverRecords.find(
      (r) => r.from === fromProvider && r.to === toProvider,
    );

    if (existing) {
      existing.count++;
    } else {
      this.failoverRecords.push({
        from: fromProvider,
        to: toProvider,
        count: 1,
      });
    }

    logger.info({ from: fromProvider, to: toProvider }, 'Failover recorded');
  }

  /**
   * Record an error for a provider.
   */
  recordError(providerId: string, error: string): void {
    this.totalErrors++;

    const existing = this.providerMetrics.get(providerId) ?? {
      requests: 0,
      totalLatencyMs: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      errors: 0,
    };

    existing.errors++;
    this.providerMetrics.set(providerId, existing);

    logger.warn({ providerId, error }, 'Error recorded');
  }

  /**
   * Get all metrics as a flat record.
   */
  getMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {
      'total.requests': this.totalRequests,
      'total.failovers': this.totalFailovers,
      'total.errors': this.totalErrors,
    };

    for (const [providerId, data] of this.providerMetrics) {
      metrics[`${providerId}.requests`] = data.requests;
      metrics[`${providerId}.latency.totalMs`] = data.totalLatencyMs;
      metrics[`${providerId}.latency.avgMs`] =
        data.requests > 0 ? data.totalLatencyMs / data.requests : 0;
      metrics[`${providerId}.tokens`] = data.totalTokens;
      metrics[`${providerId}.cost`] = data.totalCostUsd;
      metrics[`${providerId}.errors`] = data.errors;
    }

    for (const record of this.failoverRecords) {
      metrics[`failover.${record.from}->${record.to}`] = record.count;
    }

    return metrics;
  }

  /**
   * Get per-provider metrics.
   */
  getProviderMetrics(
    providerId: string,
  ): ProviderMetric | undefined {
    return this.providerMetrics.get(providerId);
  }

  /**
   * Get failover records.
   */
  getFailoverRecords(): FailoverRecord[] {
    return [...this.failoverRecords];
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.providerMetrics.clear();
    this.failoverRecords.length = 0;
    this.totalRequests = 0;
    this.totalFailovers = 0;
    this.totalErrors = 0;
    logger.info('Metrics reset');
  }
}
