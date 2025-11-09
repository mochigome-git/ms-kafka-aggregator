import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";
import { reloadConfig, getConfigs } from "../models/metricConfig";

let configChannel: any = null;
let stopRequested = false;
let reconnectAttempts = 0;
let watcherRunning = false;

const MAX_RETRIES = 10;
const BASE_DELAY = 2000;
const MAX_BACKOFF = 30000;

export async function startConfigWatcher(): Promise<boolean> {
  stopRequested = false;

  async function connectWatcher(): Promise<void> {
    if (stopRequested) return;

    try {
      // Clean up previous channel
      if (configChannel) await removeChannel();

      configChannel = supabase.channel("metric_config_updates").on(
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
      );

      await subscribeWithReconnect(configChannel);
    } catch (err) {
      logger.error("Error connecting watcher:", err);
      await scheduleReconnect();
    }
  }

  async function subscribeWithReconnect(channel: any) {
    const status = await new Promise<string>((resolve) => {
      channel.subscribe((s: string) => resolve(s));
    });

    if (stopRequested) return;

    if (status === "SUBSCRIBED") {
      reconnectAttempts = 0;
      logger.info("✅ Realtime config watcher connected");
    } else if (
      status === "CHANNEL_ERROR" ||
      status === "CLOSED" ||
      status === "TIMED_OUT"
    ) {
      watcherRunning = false;
      logger.warn(`⚠️ Config watcher channel issue: ${status}`);
      await scheduleReconnect();
    }
  }

  async function scheduleReconnect() {
    if (stopRequested) return;

    reconnectAttempts++;
    if (reconnectAttempts > MAX_RETRIES) {
      logger.error("❌ Max reconnect attempts reached — giving up.");
      return;
    }

    const delay = Math.min(
      BASE_DELAY * 2 ** (reconnectAttempts - 1),
      MAX_BACKOFF
    );
    logger.info(
      `⏳ Reconnecting config watcher in ${delay}ms (attempt ${reconnectAttempts})`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (!stopRequested) {
      await connectWatcher();
    }
  }

  async function removeChannel() {
    if (!configChannel) return;

    try {
      supabase.removeChannel(configChannel); // synchronous
      logger.info("🛑 Config channel removed successfully");
    } catch (err) {
      logger.warn("Failed to remove channel:", err);
    } finally {
      configChannel = null;
    }
  }

  await connectWatcher();
  watcherRunning = true;
  return true;
}

export async function stopConfigWatcher(): Promise<void> {
  stopRequested = true;
  if (!configChannel) return;

  try {
    await supabase.removeChannel(configChannel);
    configChannel = null;
    watcherRunning = false;
    logger.info("🛑 Config watcher stopped successfully");
  } catch (error) {
    logger.warn("Failed to stop config watcher:", error);
  }
}

export function isWatcherActive(): boolean {
  return configChannel?.state === "SUBSCRIBED";
}

export function checkConfigWatcher() {
  return watcherRunning;
}
