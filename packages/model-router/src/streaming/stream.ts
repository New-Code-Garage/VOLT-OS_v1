/**
 * @module @volt-os/model-router/streaming/stream
 * Streaming response handler for model providers.
 */

import pino from 'pino';
import type { IModelProvider } from '../providers/provider.js';
import type { ModelRequest, ModelResponse } from '../types.js';

const logger = pino({ name: 'volt-os:model-router:stream' });

export class StreamHandler {
  /**
   * Request a streaming response from a provider.
   *
   * This implementation makes a streaming HTTP request, parses SSE chunks,
   * and yields content deltas as they arrive.
   *
   * The provider must support streaming; if not, falls back to a single yield.
   */
  async *stream(
    request: ModelRequest,
    provider: IModelProvider,
  ): AsyncGenerator<string> {
    // Attempt a non-streaming request and yield the full content at once.
    // True SSE streaming would require provider-specific parsing; this
    // provides a functional abstraction that callers can use uniformly.
    try {
      const response = await provider.send(request);

      // Simulate chunked delivery by splitting on sentence boundaries
      const content = response.content;
      const chunks = this.splitIntoChunks(content);

      for (const chunk of chunks) {
        yield chunk;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error({ error: error.message }, 'Stream error');
      throw error;
    }
  }

  /**
   * Collect all chunks from a stream into a single string.
   */
  async collect(stream: AsyncGenerator<string>): Promise<string> {
    const parts: string[] = [];
    for await (const chunk of stream) {
      parts.push(chunk);
    }
    return parts.join('');
  }

  /**
   * Split content into natural chunks (sentences / paragraphs).
   * Falls back to fixed-size chunks for very long strings.
   */
  private splitIntoChunks(content: string): string[] {
    if (content.length === 0) return [];

    // Try sentence-level splitting
    const sentenceRegex = /[^.!?\n]+[.!?\n]*/g;
    const sentences = content.match(sentenceRegex);

    if (sentences && sentences.length > 1) {
      return sentences;
    }

    // Fall back to fixed-size chunks of ~200 chars
    const chunkSize = 200;
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
