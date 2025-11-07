import { calculateBucketStart } from "../utils/timeBucket";
import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";
import type { TelemetryRecord } from "../models/telemetryRecord";
import type { MetricConfig } from "../models/metricConfig";

export async function aggregateTelemetry(
  records: TelemetryRecord[],
  config: MetricConfig
) {
  const cutoff = new Date(Date.now() - config.interval_seconds * 1000);
  const filtered = records.filter((r) => new Date(r.created_at) >= cutoff);

  const grouped = new Map<string, any>();

  for (const r of filtered) {
    const bucket = calculateBucketStart(r.created_at, config.bucket_level);
    const key = `${r.tenant_id}-${r.entity_id}-${bucket}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...r,
        bucket_start: bucket,
        count: 0,
        sum1: 0,
        sum2: 0,
        sum3: 0,
      });
    }

    const item = grouped.get(key);
    item.count++;
    item.sum1 += r.core_1;
    item.sum2 += r.core_2;
    item.sum3 += r.core_3;
  }

  for (const item of grouped.values()) {
    const avg1 = item.sum1 / item.count;
    const avg2 = item.sum2 / item.count;
    const avg3 = item.sum3 / item.count;

    const { error } = await supabase
      .from(`analytics.${config.method}_metrics`)
      .upsert({
        tenant_id: item.tenant_id,
        device_id: item.device_id,
        entity_id: item.entity_id,
        bucket_start: item.bucket_start,
        avg_core_1: avg1,
        avg_core_2: avg2,
        avg_core_3: avg3,
        data: item.data || {},
        lot_id: item.lot_id || null,
      });

    if (error) {
      logger.error(`Insert failed for ${config.method}: ${error.message}`);
    } else {
      logger.info(
        `Inserted aggregated record for ${config.method}: ${item.bucket_start}`
      );
    }
  }
}
