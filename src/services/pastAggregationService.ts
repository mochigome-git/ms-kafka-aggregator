import type { TelemetryRecord, FastAggregatedItem } from "../models";
import type { MetricConfig } from "../models/metricConfig";
import { flushToDB } from "../db/flush-logic";
import { calculateBucketStart } from "../utils/timeBucket";
import { getExistingBuckets } from "../db/dbCheck";

// Keep track of already flushed past buckets (prevent duplicate flush in memory)
const aggregatedPastBuckets = new Map<string, Set<string>>();

export async function aggregatePastTelemetry(
  records: TelemetryRecord[],
  config: MetricConfig
) {
  if (!config.is_active || records.length === 0) return;

  if (!aggregatedPastBuckets.has(config.method)) {
    aggregatedPastBuckets.set(config.method, new Set());
  }
  const aggregatedSet = aggregatedPastBuckets.get(config.method)!;

  const pastBuckets = new Map<string, FastAggregatedItem>();
  const interval = config.interval_seconds || 10;

  for (const r of records) {
    const createdAt = new Date(r.created_at);
    const bucketStart = calculateBucketStart(createdAt, "second", interval);
    const key = `${r.tenant_id}-${r.entity_id}-${bucketStart.toISOString()}`;

    // Skip if already flushed
    if (aggregatedSet.has(key)) continue;

    if (!pastBuckets.has(key)) {
      pastBuckets.set(key, {
        tenant_id: r.tenant_id,
        device_id: r.device_id,
        machine_id: r.machine_id,
        bucket_start: bucketStart,
        count: 0,
        sum1: 0,
        sum2: 0,
        sum3: 0,
        data: r.data,
        lot_id: r.lot_id,
      });
    }

    const item = pastBuckets.get(key)!;
    item.count++;
    item.sum1 += r.core_1;
    item.sum2 += r.core_2;
    item.sum3 += r.core_3;
  }

  if (pastBuckets.size === 0) return;

  // Remove any bucket that already exists in DB
  const existingBuckets = await getExistingBuckets(config.method, pastBuckets);
  for (const key of existingBuckets) pastBuckets.delete(key);

  if (pastBuckets.size === 0) return;

  // Flush to DB, **overwrite = true** for past data
  await flushToDB(pastBuckets, config, true);

  // Mark as flushed
  for (const key of pastBuckets.keys()) aggregatedSet.add(key);
}
