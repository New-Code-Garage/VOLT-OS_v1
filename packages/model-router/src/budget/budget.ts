/**
 * @module @volt-os/model-router/budget/budget
 * Budget enforcement and usage tracking.
 */

import pino from 'pino';
import type { BudgetConfig, BudgetUsage, ModelRequest } from '../types.js';
import type { IModelProvider } from '../providers/provider.js';

const logger = pino({ name: 'volt-os:model-router:budget' });

/** Daily usage tracking. */
interface DailyUsage {
  costUsd: number;
  tokens: number;
  requestCount: number;
  date: string; // YYYY-MM-DD
}

export class BudgetManager {
  private readonly config: BudgetConfig;
  private daily: DailyUsage;

  constructor(config: BudgetConfig) {
    this.config = config;
    this.daily = this.createFreshDaily();
  }

  /**
   * Check whether a request is within budget for the given provider.
   * Returns `{ allowed: true }` or `{ allowed: false, reason }`.
   */
  checkBudget(
    request: ModelRequest,
    provider: IModelProvider,
  ): { allowed: boolean; reason?: string } {
    // Refresh daily counters if we've rolled over to a new day
    this.refreshIfNewDay();

    // Per-request cost limit
    if (this.config.maxCostPerRequest !== undefined) {
      // Rough estimate: assume maxTokens tokens at typical cost
      const estimatedTokens = request.maxTokens ?? 4096;
      const estimatedCost = estimatedTokens * 0.00003; // ~$0.03/1K tokens estimate
      if (estimatedCost > this.config.maxCostPerRequest) {
        const reason = `Estimated cost $${estimatedCost.toFixed(4)} exceeds per-request limit $${this.config.maxCostPerRequest}`;
        logger.warn({ providerId: provider.id, reason }, 'Budget check failed');
        return { allowed: false, reason };
      }
    }

    // Daily cost limit
    if (this.config.maxCostPerDay !== undefined) {
      if (this.daily.costUsd >= this.config.maxCostPerDay) {
        const reason = `Daily cost $${this.daily.costUsd.toFixed(4)} has reached limit $${this.config.maxCostPerDay}`;
        logger.warn({ providerId: provider.id, reason }, 'Budget check failed');
        return { allowed: false, reason };
      }
    }

    // Daily token limit
    if (this.config.maxTokensPerDay !== undefined) {
      if (this.daily.tokens >= this.config.maxTokensPerDay) {
        const reason = `Daily tokens ${this.daily.tokens} has reached limit ${this.config.maxTokensPerDay}`;
        logger.warn({ providerId: provider.id, reason }, 'Budget check failed');
        return { allowed: false, reason };
      }
    }

    return { allowed: true };
  }

  /**
   * Record actual usage after a completed request.
   */
  recordUsage(costUsd: number, tokens: number): void {
    this.refreshIfNewDay();

    this.daily.costUsd += costUsd;
    this.daily.tokens += tokens;
    this.daily.requestCount++;

    logger.info(
      {
        costUsd: costUsd.toFixed(6),
        tokens,
        dailyCost: this.daily.costUsd.toFixed(6),
        dailyTokens: this.daily.tokens,
      },
      'Usage recorded',
    );
  }

  /**
   * Get current daily usage snapshot.
   */
  getDailyUsage(): BudgetUsage {
    this.refreshIfNewDay();
    return {
      costUsd: this.daily.costUsd,
      tokens: this.daily.tokens,
      requestCount: this.daily.requestCount,
    };
  }

  /**
   * Reset daily counters (for testing or manual reset).
   */
  resetDaily(): void {
    this.daily = this.createFreshDaily();
    logger.info('Daily budget counters reset');
  }

  /**
   * Get the remaining budget for today.
   */
  getRemaining(): { costUsd: number; tokens: number } {
    this.refreshIfNewDay();
    return {
      costUsd:
        this.config.maxCostPerDay !== undefined
          ? Math.max(0, this.config.maxCostPerDay - this.daily.costUsd)
          : Infinity,
      tokens:
        this.config.maxTokensPerDay !== undefined
          ? Math.max(0, this.config.maxTokensPerDay - this.daily.tokens)
          : Infinity,
    };
  }

  /**
   * Get the budget configuration.
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  /** Check if we've rolled to a new day and reset if so. */
  private refreshIfNewDay(): void {
    const today = this.todayString();
    if (this.daily.date !== today) {
      this.daily = this.createFreshDaily();
    }
  }

  private createFreshDaily(): DailyUsage {
    return {
      costUsd: 0,
      tokens: 0,
      requestCount: 0,
      date: this.todayString(),
    };
  }

  private todayString(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
