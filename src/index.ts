import { logger } from "./utils/logger";
import { initKafka } from "./services/kafkaService";
import { loadMetricConfigs } from "./models/metricConfig";
import { startConfigWatcher } from "./realtime/configWatcher";
import { testConnection } from "./db/connection";

async function main() {
  logger.info("🚀 Starting telemetry aggregator service...");

  try {
    // Test database connection
    logger.info("Testing database connection...");
    const isConnected = await testConnection(5, 5000);
    if (!isConnected) {
      throw new Error("Failed to establish database connection");
    }
    logger.info("✅ Database connection established");

    // Load configurations and start services
    const configs = await loadMetricConfigs();
    logger.info(`✅ Loaded ${configs.length} active metric configurations`);

    await initKafka(configs);
    logger.info("✅ Kafka consumer initialized");

    startConfigWatcher();
    logger.info("✅ Config watcher started");

    logger.info("✅ Service initialized successfully.");
  } catch (error: any) {
    logger.error(`❌ Service initialization failed: ${error.message}`);
    process.exit(1);
  }
}

// Error handlers
process.on("uncaughtException", (error: Error) => {
  logger.error("🛑 Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logger.error("🛑 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("🛑 Received SIGINT. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("🛑 Received SIGTERM. Shutting down gracefully...");
  process.exit(0);
});

main();
