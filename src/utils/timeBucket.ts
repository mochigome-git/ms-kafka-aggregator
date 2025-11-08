/**
 * Helper: calculate bucket start
 */
export function calculateBucketStart(
  timestamp: string | Date,
  bucketLevel: string,
  intervalSeconds: number
): Date {
  const date = new Date(timestamp);
  const bucketMs = intervalSeconds * 1000;
  const bucketStartMs = Math.floor(date.getTime() / bucketMs) * bucketMs;
  return new Date(bucketStartMs);
}
