import fs from "fs";
import { Kafka } from "kafkajs";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";
import { aggregateTelemetry } from "./aggregationService";
import { getConfigs } from "../models/metricConfig";
import type { TelemetryRecord } from "../models/telemetryRecord";

const kafka = new Kafka({
  brokers: [ENV.KAFKA_BROKER],
  clientId: "telemetry-aggregator",
  ssl: {
    rejectUnauthorized: false, // set true if want strict cert validation
    ca: [fs.readFileSync(ENV.KAFKA_CA_CERT_PATH, "utf-8")],
  },
  connectionTimeout: 5000, // 5s timeout
  retry: {
    initialRetryTime: 300,
    retries: 3, // limit retries
  },
});

export async function initKafka(configs: any[]) {
  const consumer = kafka.consumer({ groupId: "telemetry-group" });
  await consumer.connect();
  await consumer.subscribe({ topic: ENV.KAFKA_TOPIC, fromBeginning: false });

  logger.info(`Kafka connected. Listening on topic: ${ENV.KAFKA_TOPIC}`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const raw = JSON.parse(message.value!.toString());

        // EMQX wraps actual telemetry JSON in `raw.payload`
        const inner =
          typeof raw.payload === "string"
            ? JSON.parse(raw.payload)
            : raw.payload;

        // Optional: Normalize numeric strings and add timestamp
        const payload: TelemetryRecord = {
          ...inner,
          core_1: parseFloat(inner.core_1),
          core_2: parseFloat(inner.core_2),
          core_3: inner.core_3 ? parseFloat(inner.core_3) : undefined,
          temp: inner.temp ? parseFloat(inner.temp) : undefined,
          created_at: new Date().toISOString(),
        };

        const configs = getConfigs();

        logger.debug(`Received payload for tenant: ${payload.tenant_id}`);

        for (const cfg of configs) {
          if (!cfg.is_active || cfg.method !== "fast") continue;

          // Match either by device_id or machine_id
          const matchByDevice = cfg.entity_id === payload.device_id;
          const matchByMachine = cfg.entity_id === payload.machine_id;

          console.log(cfg.entity_id, payload.device_id);
          if (matchByDevice || matchByMachine) {
            logger.info(
              `Matched config ${cfg.id} (${cfg.method}) for device ${
                payload.device_id || "-"
              }`
            );
            await aggregateTelemetry([payload], cfg);
          }
        }
      } catch (err: any) {
        logger.error(`Failed to process Kafka message: ${err.message}`);
      }
    },
  });
}
