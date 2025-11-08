import { supabase } from "../config/supabase";
import { logger } from "../utils/logger";

export interface MetricConfig {
  id: number;
  tenant_id: string;
  entity_id: string;
  method: "realtime" | "fast" | "hourly" | "event";
  interval_seconds: number;
  bucket_level: "second" | "minute" | "hour" | "day" | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

let cache: MetricConfig[] = [];
let lastLoaded: Date | null = null;

export async function loadMetricConfigs(): Promise<MetricConfig[]> {
  try {
    const { data, error } = await supabase
      .from("metric_method_config")
      .select("*")
      .eq("is_active", true)
      .eq("method", "fast")
      .order("tenant_id")
      .order("entity_id");

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    cache = data || [];
    lastLoaded = new Date();

    logger.info(`Loaded ${cache.length} active metric configurations`);
    return cache;
  } catch (error) {
    logger.error("Failed to load metric configs:", error);
    // Return cached data as fallback
    return cache;
  }
}

export async function reloadConfig(): Promise<void> {
  logger.info("Reloading metric configurations...");
  await loadMetricConfigs();
}

export function getConfigs(): MetricConfig[] {
  return [...cache]; // Return copy to prevent mutation
}
