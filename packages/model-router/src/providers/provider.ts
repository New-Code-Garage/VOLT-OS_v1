/**
 * @module @volt-os/model-router/providers/provider
 * Interface that all model providers must implement.
 */

import type { ModelProviderType } from '../types.js';
import type { ModelRequest } from '../types.js';
import type { ModelResponse } from '../types.js';
import type { ProviderHealth } from '../types.js';

export interface IModelProvider {
  readonly id: string;
  readonly type: ModelProviderType;

  /** Send a request to the model provider and return a response. */
  send(request: ModelRequest): Promise<ModelResponse>;

  /** Check provider health. */
  healthCheck(): Promise<ProviderHealth>;

  /** Determine whether this provider can satisfy the given request. */
  canHandle(request: ModelRequest): boolean;
}
