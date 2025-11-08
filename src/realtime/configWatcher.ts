import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";
import { reloadConfig, getConfigs } from "../models/metricConfig";

let configChannel: any = null;

export async function startConfigWatcher(): Promise<boolean> {
  try {
    // Clean up existing channel if any
    if (configChannel) {
      await stopConfigWatcher();
    }

    configChannel = supabase
      .channel("metric_config_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "metric_method_config",
        },
        async (payload) => {
          logger.info(`Config change detected: ${payload.eventType}`, {
            table: payload.table,
            recordId: (payload.new as any)?.id || (payload.old as any)?.id,
          });

          try {
            await reloadConfig();
            const configs = getConfigs();
            logger.info(
              `Configuration reloaded successfully. ${configs.length} active configs loaded.`
            );
          } catch (error) {
            logger.error("Failed to reload configuration:", error);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          logger.info("Realtime config watcher started successfully");
        } else if (status === "CHANNEL_ERROR") {
          logger.error("Config watcher channel error");
        } else if (status === "TIMED_OUT") {
          logger.warn("Config watcher channel timed out");
        }
      });

    return true;
  } catch (error) {
    logger.error("Failed to start config watcher:", error);
    return false;
  }
}

export async function stopConfigWatcher(): Promise<void> {
  if (!configChannel) return;

  try {
    await supabase.removeChannel(configChannel);
    configChannel = null;
    logger.info("Config watcher stopped successfully");
  } catch (error) {
    // During shutdown, this is not critical
    logger.warn(
      "Config watcher removal failed (probably shutting down):",
      error
    );
  }
}

export function isWatcherActive(): boolean {
  return configChannel?.state === "SUBSCRIBED";
}
