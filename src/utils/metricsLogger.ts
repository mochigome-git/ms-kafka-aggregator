import { logger } from "./logger";

let totalFlushedPast = 0;
let totalFlushedLive = 0;

export function addFlushCount(count: number, isPast: boolean) {
  if (isPast) totalFlushedPast += count;
  else totalFlushedLive += count;
}

// Periodic 30-min logging (resets counters)
export function logFlushSummaryPeriodic() {
  logger.info(
    `📊 Flushed summary in last period: past=${totalFlushedPast}, live=${totalFlushedLive}`
  );
  totalFlushedPast = 0;
  totalFlushedLive = 0;
}

// Final logging at shutdown (does NOT reset counters)
export function logFlushSummaryFinal() {
  logger.info(
    `📊 Final flushed totals: past=${totalFlushedPast}, live=${totalFlushedLive}`
  );
}
