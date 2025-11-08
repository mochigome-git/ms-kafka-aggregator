import { logger } from "../utils/logger";
import {
  logFlushSummaryPeriodic,
  logFlushSummaryFinal,
} from "../utils/metricsLogger";
import { ENV } from "../config/env";

let heartbeatInterval: ReturnType<typeof setInterval>;
let flushSummaryInterval: ReturnType<typeof setInterval>;

export function startMonitoring() {
  // Service heartbeat
  heartbeatInterval = setInterval(() => {
    logger.debug("💓 Service heartbeat - running normally");
  }, 60_000); // every 1 min

  // Flush summary every * min
  flushSummaryInterval = setInterval(() => {
    logFlushSummaryPeriodic();
  }, (ENV.LOG_SUMMARY_TIMER || 1) * 60_000);
}

export function stopMonitoring() {
  clearInterval(heartbeatInterval);
  clearInterval(flushSummaryInterval);
  // Log final flush summary
  logFlushSummaryFinal();
}
