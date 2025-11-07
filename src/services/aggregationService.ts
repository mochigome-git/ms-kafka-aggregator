import type { TelemetryRecord } from "../models/telemetryRecord";
import type { MetricConfig } from "../models/metricConfig";

import { pool } from "../config/supabase";
import { executeWithRetry } from "../db/connection";

import { logger } from "../utils/logger";
import { calculateBucketStart } from "../utils/timeBucket";

export async function aggregateTelemetry(
  records: TelemetryRecord[],
  config: MetricConfig
) {
  const cutoff = new Date(Date.now() - config.interval_seconds * 1000);
  const filtered = records.filter((r) => new Date(r.created_at) >= cutoff);

  if (filtered.length === 0) {
    logger.debug("No records to process after filtering");
    return;
  }

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

  // Direct approach - wrap the database operations with retry
  await executeWithRetry(
    async () => {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        for (const item of grouped.values()) {
          const avg1 = item.sum1 / item.count;
          const avg2 = item.sum2 / item.count;
          const avg3 = item.sum3 / item.count;

          const query = `
          INSERT INTO analytics.${config.method}_metrics
            (tenant_id, device_id, machine_id, bucket_start,
            avg_core_1, avg_core_2, avg_core_3, data, lot_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (tenant_id, entity_id, bucket_start)
          DO UPDATE SET
            avg_core_1 = EXCLUDED.avg_core_1,
            avg_core_2 = EXCLUDED.avg_core_2,
            avg_core_3 = EXCLUDED.avg_core_3,
            data = EXCLUDED.data,
            lot_id = EXCLUDED.lot_id;
        `;

          const values = [
            item.tenant_id,
            item.device_id || null,
            item.machine_id || null,
            item.bucket_start,
            avg1,
            avg2,
            avg3,
            item.data || {},
            item.lot_id || null,
          ];

          await client.query(query, values);
          logger.info(
            `Upserted aggregated record for ${config.method}: ${item.bucket_start}`
          );
        }

        await client.query("COMMIT");
        logger.info(
          `Successfully processed ${grouped.size} aggregated records for ${config.method}`
        );
      } catch (err: any) {
        await client.query("ROLLBACK");
        logger.error(
          `Database operation failed for ${config.method}: ${err.message}`
        );
        throw err; // This will trigger the retry
      } finally {
        client.release();
      }
    },
    3,
    1000
  ).catch((error) => {
    logger.error(`All retries failed for ${config.method}: ${error.message}`);
  });
}
