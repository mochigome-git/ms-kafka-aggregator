import type { MetricConfig } from "../models/metricConfig";
import type { FastAggregatedItem } from "../models";
import { liveBuffers } from "./pushLiveTelemetry";
import { flushToDB } from "../db/flush-logic";

/**
 * Track which live buckets have been flushed per metric
 */
const flushedLiveBuckets: Map<string, Set<string>> = new Map();

/**
 * Start live buffer flushers based on each metric's interval_seconds
 */
export function startLiveFlush(configs: MetricConfig[]) {
  for (const cfg of configs) {
    if (!cfg.is_active) continue;

    const intervalMs = (cfg.interval_seconds || 10) * 1000;

    if (!flushedLiveBuckets.has(cfg.method)) {
      flushedLiveBuckets.set(cfg.method, new Set<string>());
    }
    const flushedSet = flushedLiveBuckets.get(cfg.method)!;

    setInterval(async () => {
      const buffer = liveBuffers.get(cfg.method);
      if (!buffer || buffer.size === 0) return;

      const now = new Date();
      const bucketsToFlush: Map<string, FastAggregatedItem> = new Map();

      for (const [key, item] of buffer.entries()) {
        const bucketEnd = new Date(item.bucket_start.getTime() + intervalMs);

        // Flush only if interval has ended and bucket not already flushed
        if (now >= bucketEnd && !flushedSet.has(key)) {
          bucketsToFlush.set(key, item);
          flushedSet.add(key);
          buffer.delete(key); // remove flushed bucket from memory
        }
      }

      if (bucketsToFlush.size === 0) return;

      //  logger.info(
      //    `[info] Flushing ${bucketsToFlush.size} live records for ${cfg.method}`
      //  );
      await flushToDB(bucketsToFlush, cfg, false); // never overwrite
    }, 1000); // check every second
  }
}
