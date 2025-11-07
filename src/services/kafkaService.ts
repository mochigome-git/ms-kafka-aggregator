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
});

export async function initKafka(configs: any[]) {
  const consumer = kafka.consumer({ groupId: "telemetry-group" });
  await consumer.connect();
  await consumer.subscribe({ topic: ENV.KAFKA_TOPIC, fromBeginning: false });

  logger.info(`Kafka connected. Listening on topic: ${ENV.KAFKA_TOPIC}`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(
          message.value!.toString()
        ) as TelemetryRecord;
        const configs = getConfigs();

        console.log(payload);

        for (const cfg of configs) {
          logger.debug(
            `Checking cfg ${cfg.entity_id} vs payload ${payload.entity_id}`
          );

          if (cfg.is_active && cfg.method === "fast") {
            await aggregateTelemetry([payload], cfg);
          }
        }
      } catch (err: any) {
        logger.error(`Failed to process Kafka message: ${err.message}`);
      }
    },
  });
}
