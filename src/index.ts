import { logger } from './utils/logger';
import { initKafka } from './services/kafkaService';
import { loadMetricConfigs } from './models/metricConfig';
import { startConfigWatcher } from './realtime/configWatcher';

async function main() {
  logger.info('🚀 Starting telemetry aggregator service...');

  const configs = await loadMetricConfigs();
  logger.info(`Loaded ${configs.length} active metric configurations`);

  await initKafka(configs);
  startConfigWatcher();

  logger.info('✅ Service initialized successfully.');
}

main().catch((err) => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
