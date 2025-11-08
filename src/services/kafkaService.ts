import type { TelemetryRecord } from "../models/telemetryRecord";

import { Kafka } from "kafkajs";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";
import { pushLiveTelemetry } from "./pushLiveTelemetry";
import { aggregatePastTelemetry } from "./pastAggregationService";

import { getConfigs, MetricConfig, reloadConfig } from "../models/metricConfig";
import { startLiveFlush } from "./liveBufferService";

const kafka = new Kafka({
  brokers: [ENV.KAFKA_BROKER],
  clientId: "telemetry-aggregator",
  ssl: {
    rejectUnauthorized: false,
    ca: ENV.KAFKA_CA_CERT,
  },
  connectionTimeout: 5000,
  retry: { initialRetryTime: 300, retries: 3 },
});

let kafkaConsumer: ReturnType<Kafka["consumer"]> | null = null;

export async function initKafka(configs: MetricConfig[]) {
  if (kafkaConsumer) {
    logger.warn("Kafka consumer already initialized.");
    return;
  }

  await reloadConfig();
  startLiveFlush(getConfigs());

  kafkaConsumer = kafka.consumer({ groupId: "telemetry-group" });
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe({
    topic: ENV.KAFKA_TOPIC,
    fromBeginning: true,
  });

  logger.info(`Kafka connected. Listening on topic: ${ENV.KAFKA_TOPIC}`);

  await kafkaConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const raw = JSON.parse(message.value!.toString());
        const inner =
          typeof raw.payload === "string"
            ? JSON.parse(raw.payload)
            : raw.payload;

        const payload: TelemetryRecord = {
          ...inner,
          core_1: parseFloat(inner.core_1),
          core_2: parseFloat(inner.core_2),
          core_3: inner.core_3 ? parseFloat(inner.core_3) : undefined,
          temp: inner.temp ? parseFloat(inner.temp) : undefined,
          created_at: inner.created_at || new Date().toISOString(),
        };

        const activeConfigs = getConfigs().filter((c) => c.is_active);

        for (const cfg of activeConfigs) {
          const match =
            cfg.entity_id === payload.device_id ||
            cfg.entity_id === payload.machine_id;
          if (!match) continue;

          const interval = cfg.interval_seconds || 10;
          const bucketStart = new Date(
            Math.floor(
              new Date(payload.created_at).getTime() / 1000 / interval
            ) *
              interval *
              1000
          );
          const bucketEnd = new Date(bucketStart.getTime() + interval * 1000);

          if (bucketEnd <= new Date()) {
            await aggregatePastTelemetry([payload], cfg);
          } else {
            pushLiveTelemetry([payload], cfg);
          }
        }
      } catch (err: any) {
        logger.error(`Failed to process Kafka message: ${err.message}`);
      }
    },
  });
}

export async function shutdownKafka(): Promise<void> {
  if (!kafkaConsumer) return;

  logger.info("Stopping Kafka consumer...");
  try {
    await kafkaConsumer.disconnect();
    kafkaConsumer = null;
    logger.info("✅ Kafka consumer stopped");
  } catch (error) {
    logger.error("Error stopping Kafka consumer:", error);
    throw error;
  }
}
