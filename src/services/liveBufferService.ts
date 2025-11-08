import type { MetricConfig } from "../models/metricConfig";
import type { FastAggregatedItem } from "../models";
import { liveBuffers } from "./pushLiveTelemetry";
import { flushToDB } from "../db/flush-logic";

/**
 * Track which live buckets have been flushed per metric
 */
const flushedLiveBuckets: Map<number, Set<string>> = new Map();

/**
 * Start live buffer flushers based on each metric's interval_seconds
 */

export function startLiveFlush(configs: MetricConfig[]) {
  for (const cfg of configs) {
    if (!cfg.is_active) continue;

    const intervalMs = (cfg.interval_seconds || 10) * 1000;

    if (!flushedLiveBuckets.has(cfg.id)) {
      flushedLiveBuckets.set(cfg.id, new Set<string>());
    }
    const flushedSet = flushedLiveBuckets.get(cfg.id)!;

    setInterval(async () => {
      const buffer = liveBuffers.get(String(cfg.id));
      if (!buffer || buffer.size === 0) return;

      const now = new Date();
      const bucketsToFlush: Map<string, FastAggregatedItem> = new Map();

      for (const [key, item] of buffer.entries()) {
        const bucketEnd = new Date(item.bucket_start.getTime() + intervalMs);

        if (now >= bucketEnd && !flushedSet.has(key)) {
          bucketsToFlush.set(key, item);
          flushedSet.add(key);
          buffer.delete(key);
        }
      }

      if (bucketsToFlush.size > 0) {
        // console.log(
        //   `[liveFlush] Flushing ${bucketsToFlush.size} records for config ${cfg.id}`
        // );
        await flushToDB(bucketsToFlush, cfg, false);
      }
    }, 1000);
  }
}
