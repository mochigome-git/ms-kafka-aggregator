import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";
import { reloadConfig, getConfigs } from "../models/metricConfig";

let configChannel: any = null;
let reconnectAttempts = 0;
let isReconnecting = false;
let stopRequested = false;

const MAX_RETRIES = 10; // limit attempts before giving up
const BASE_DELAY = 2000; // ms

export async function startConfigWatcher(): Promise<boolean> {
  stopRequested = false;

  async function connectWatcher() {
    try {
      if (configChannel) await stopConfigWatcher();

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
            reconnectAttempts = 0;
            logger.info("✅ Realtime config watcher connected");
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "CLOSED" ||
            status === "TIMED_OUT"
          ) {
            logger.warn(`⚠️ Config watcher channel issue: ${status}`);
            handleReconnect();
          }
        });
    } catch (error) {
      logger.error("Failed to start config watcher:", error);
      handleReconnect();
    }
  }

  async function handleReconnect() {
    if (stopRequested || isReconnecting) return;

    isReconnecting = true;
    reconnectAttempts++;

    if (reconnectAttempts > MAX_RETRIES) {
      logger.error("❌ Max reconnect attempts reached — giving up.");
      isReconnecting = false;
      return;
    }

    const delay = BASE_DELAY * Math.min(2 ** (reconnectAttempts - 1), 30); // exponential backoff up to 30s
    logger.info(
      `⏳ Reconnecting config watcher in ${delay}ms (attempt ${reconnectAttempts})`
    );

    setTimeout(async () => {
      isReconnecting = false;
      if (!stopRequested) await connectWatcher();
    }, delay);
  }

  await connectWatcher();
  return true;
}

export async function stopConfigWatcher(): Promise<void> {
  stopRequested = true;

  if (!configChannel) return;

  try {
    await supabase.removeChannel(configChannel);
    configChannel = null;
    logger.info("🛑 Config watcher stopped successfully");
  } catch (error) {
    logger.warn(
      "Config watcher removal failed (likely during shutdown):",
      error
    );
  }
}

export function isWatcherActive(): boolean {
  return configChannel?.state === "SUBSCRIBED";
}
