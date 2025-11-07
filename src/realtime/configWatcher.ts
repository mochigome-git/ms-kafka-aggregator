import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";
import { reloadConfig } from "../models/metricConfig";

export async function startConfigWatcher() {
  const channel = supabase
    .channel("metric_config_updates")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "metric_method_config" },
      async (payload) => {
        logger.info(`Config change detected: ${payload.eventType}`);
        await reloadConfig();
      }
    )
    .subscribe();

  logger.info("Realtime config watcher started.");
}
