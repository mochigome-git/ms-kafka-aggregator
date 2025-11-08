import type { MetricConfig } from "../models/metricConfig";
import type { FastAggregatedItem } from "../models";

import { executeWithRetry } from "./connection";
import { logger } from "../utils/logger";
import { pool } from "../config/supabase";
import { addFlushCount } from "../utils/metricsLogger";

/**
 * Flush a map of aggregated items to DB
 * @param overwrite - if true, will update existing DB rows (past data)
 *                    if false, will only insert new rows, never overwrite (live data)
 */
export async function flushToDB(
  buffer: Map<string, FastAggregatedItem>,
  config: MetricConfig,
  overwrite: boolean
) {
  if (buffer.size === 0) return;

  await executeWithRetry(
    async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        for (const item of buffer.values()) {
          const avg1 = item.sum1 / item.count;
          const avg2 = item.sum2 / item.count;
          const avg3 = item.sum3 / item.count;

          const query = overwrite
            ? `
            INSERT INTO analytics.${config.method}_metrics
              (tenant_id, device_id, machine_id, bucket_start,
               avg_core_1, avg_core_2, avg_core_3, data, lot_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (tenant_id, entity_id, bucket_start)
            DO UPDATE SET
              avg_core_1=EXCLUDED.avg_core_1,
              avg_core_2=EXCLUDED.avg_core_2,
              avg_core_3=EXCLUDED.avg_core_3,
              data=EXCLUDED.data,
              lot_id=EXCLUDED.lot_id;
          `
            : `
            INSERT INTO analytics.${config.method}_metrics
              (tenant_id, device_id, machine_id, bucket_start,
               avg_core_1, avg_core_2, avg_core_3, data, lot_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (tenant_id, entity_id, bucket_start)
            DO NOTHING;
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
        }

        await client.query("COMMIT");
        // logger.info(
        //   `Flushed ${buffer.size} records for ${config.method} (${
        //     overwrite ? "past" : "live"
        //   })`
        // );

        addFlushCount(buffer.size, overwrite);

        if (!overwrite) buffer.clear(); // clear live buffer after flush
      } catch (err: any) {
        await client.query("ROLLBACK");
        logger.error(`DB flush failed for ${config.method}: ${err.message}`);
        throw err;
      } finally {
        client.release();
      }
    },
    3,
    1000
  );
}
