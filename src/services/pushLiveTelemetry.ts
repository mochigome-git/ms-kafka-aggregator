import type { TelemetryRecord, FastAggregatedItem } from "../models";
import type { MetricConfig } from "../models/metricConfig";

// In-memory store for live data
export const liveBuffers = new Map<string, Map<string, FastAggregatedItem>>();

export function pushLiveTelemetry(
  records: TelemetryRecord[],
  config: MetricConfig
) {
  if (!config.is_active || records.length === 0) return;

  const interval = config.interval_seconds || 10;
  const bufferKey = String(config.id);

  if (!liveBuffers.has(bufferKey)) liveBuffers.set(bufferKey, new Map());
  const buffer = liveBuffers.get(bufferKey)!;

  for (const r of records) {
    const bucketStart = new Date(
      Math.floor(new Date(r.created_at).getTime() / 1000 / interval) *
        interval *
        1000
    );
    const key = `${r.tenant_id}-${
      r.entity_id || r.device_id
    }-${bucketStart.toISOString()}`;

    if (!buffer.has(key)) {
      buffer.set(key, {
        tenant_id: r.tenant_id,
        device_id: r.device_id,
        machine_id: r.machine_id,
        bucket_start: bucketStart,
        count: 1,
        sum1: r.core_1,
        sum2: r.core_2,
        sum3: r.core_3,
        data: r.data,
        lot_id: r.lot_id,
      });
    } else {
      const item = buffer.get(key)!;
      item.count++;
      item.sum1 += r.core_1;
      item.sum2 += r.core_2;
      item.sum3 += r.core_3;
    }
  }
}
