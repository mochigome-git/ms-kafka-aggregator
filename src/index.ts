import { logger } from "./utils/logger";
import { initKafka, shutdownKafka } from "./services/kafkaService";
import { loadMetricConfigs } from "./models/metricConfig";
import {
  startConfigWatcher,
  stopConfigWatcher,
} from "./realtime/configWatcher";
import { testConnection } from "./db/connection";
import { startMonitoring, stopMonitoring } from "./services/monitoringService";
import { startHealthServer } from "./utils/healthServer";

let isShuttingDown = false;

async function gracefulShutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("🛑 Starting graceful shutdown...");

  stopMonitoring();

  const shutdownTimeout = setTimeout(() => {
    logger.error("🛑 Shutdown timeout, forcing exit");
    process.exit(exitCode);
  }, 30_000);

  try {
    await Promise.allSettled([
      stopConfigWatcher().catch((err) =>
        logger.error("Error stopping config watcher:", err)
      ),
      shutdownKafka().catch((err) =>
        logger.error("Error shutting down Kafka:", err)
      ),
    ]);
    clearTimeout(shutdownTimeout);
    logger.info("✅ Graceful shutdown completed");
    process.exit(exitCode);
  } catch (err) {
    logger.error("🛑 Error during shutdown:", err);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

async function initializeServices() {
  const isConnected = await testConnection(5, 5000);
  if (!isConnected) throw new Error("Failed to connect to database");

  const configs = await loadMetricConfigs();
  if (configs.length === 0) logger.warn("⚠️ No active metric configurations");

  await initKafka(configs);
  const watcherStarted = await startConfigWatcher();
  if (!watcherStarted) throw new Error("Failed to start config watcher");

  const port = 8080;
  const healthServerStarted = await startHealthServer(port);
  if (!healthServerStarted) throw new Error("Faild to start health server");
}

async function main() {
  logger.info("🚀 Starting telemetry aggregator service...");

  try {
    await initializeServices();
    startMonitoring();
    logger.info(
      "🎉 Service initialized successfully and ready to process metrics"
    );
  } catch (err: any) {
    logger.error(`❌ Service initialization failed: ${err.message}`);
    await gracefulShutdown(1);
  }
}

// ---------- Error & Signal Handlers ----------
process.on("uncaughtException", (err) => {
  logger.error(err);
  gracefulShutdown(1);
});
process.on("unhandledRejection", (reason, promise) => {
  logger.error(reason);
  gracefulShutdown(1);
});
process.on("SIGINT", () => gracefulShutdown(0));
process.on("SIGTERM", () => gracefulShutdown(0));
process.on("exit", (code) =>
  logger.info(`📤 Process exiting with code: ${code}`)
);

main();
