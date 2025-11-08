import type { FastAggregatedItem } from "../models";

import { pool } from "../config/supabase";

/**
 * Check if buckets already exist in DB for a given method
 * Returns a Set of bucket keys that already exist
 */
export async function getExistingBuckets(
  method: string,
  buckets: Map<string, FastAggregatedItem>
): Promise<Set<string>> {
  if (buckets.size === 0) return new Set();

  const bucketStarts = Array.from(buckets.values()).map((b) => b.bucket_start);

  // Dynamic table name using config.method
  const tableName = `analytics.${method}_metrics`;

  const result = await pool.query(
    `
    SELECT DISTINCT bucket_start 
    FROM ${tableName} 
    WHERE bucket_start = ANY($1::timestamptz[])
  `,
    [bucketStarts]
  );

  const existingBuckets = new Set<string>();
  for (const row of result.rows) {
    existingBuckets.add(new Date(row.bucket_start).toISOString());
  }

  return existingBuckets;
}

/**
 * Get the latest bucket start for a given method
 */
export async function getLatestBucketStart(
  method: string
): Promise<Date | null> {
  const tableName = `analytics.${method}_metrics`;

  const result = await pool.query(
    `
    SELECT MAX(bucket_start) AS latest_bucket
    FROM ${tableName}
  `
  );

  return result.rows[0]?.latest_bucket
    ? new Date(result.rows[0].latest_bucket)
    : null;
}
