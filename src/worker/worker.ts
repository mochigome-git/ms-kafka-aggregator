import { parentPort } from "worker_threads";
import { pushLiveTelemetry } from "../services/pushLiveTelemetry";
import { aggregatePastTelemetry } from "../services/pastAggregationService";
import type { MetricConfig, TelemetryRecord } from "../models";

parentPort?.on(
  "message",
  async ({
    payload,
    config,
  }: {
    payload: TelemetryRecord;
    config: MetricConfig;
  }) => {
    try {
      const interval = config.interval_seconds || 10;
      const bucketStart = new Date(
        Math.floor(new Date(payload.created_at).getTime() / 1000 / interval) *
          interval *
          1000
      );
      const bucketEnd = new Date(bucketStart.getTime() + interval * 1000);

      // Past or live
      if (bucketEnd <= new Date()) {
        await aggregatePastTelemetry([payload], config);
      } else {
        pushLiveTelemetry([payload], config); // only adds to the config's buffer
      }

      parentPort?.postMessage({ success: true });
    } catch (err: any) {
      console.error(`Worker ${config.id} error:`, err);
      parentPort?.postMessage({ success: false, error: err.message });
    }
  }
);
