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
}

let cache: MetricConfig[] = [];

export async function loadMetricConfigs(): Promise<MetricConfig[]> {
  const { data, error } = await supabase
    .from("metric_method_config")
    .select("*")
    .eq("is_active", true)
    .eq("method", "fast");

  if (error) {
    logger.error(`Failed to load metric configs: ${error.message}`);
    return [];
  }

  cache = data;
  return data;
}

export async function reloadConfig() {
  logger.info("Reloading metric configurations...");
  cache = await loadMetricConfigs();
}

export function getConfigs(): MetricConfig[] {
  return cache;
}
