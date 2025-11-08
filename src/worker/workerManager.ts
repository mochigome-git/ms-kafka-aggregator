import { Worker } from "worker_threads";
import { join } from "path";
import { logger } from "../utils/logger";
import type { MetricConfig } from "../models/metricConfig";
import type { TelemetryRecord } from "../models/telemetryRecord";
import { getConfigs } from "../models/metricConfig";

const workers = new Map<number, Worker>();

export function startWorkers(configs: MetricConfig[]) {
  for (const cfg of configs) {
    const id = Number(cfg.id); // ensure numeric
    if (!workers.has(id)) {
      const workerPath = join(__dirname, "worker.ts"); // for ts-node
      const worker = new Worker(workerPath, {
        execArgv: ["-r", "ts-node/register"],
      });

      worker.on("message", (msg) => {
        if (!msg.success) {
          logger.error(`Worker for config ${id} error: ${msg.error}`);
        }
      });

      worker.on("error", (err) => {
        logger.error(`Worker for config ${id} crashed: ${err.message}`);
        workers.delete(id);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          logger.error(`Worker for config ${id} exited with code ${code}`);
        }
        workers.delete(id);
      });

      workers.set(id, worker);
      logger.info(`Started worker for config ${id}`);
    }
  }
}

export function handlePayload(payload: TelemetryRecord) {
  const activeConfigs = getConfigs().filter((c) => c.is_active);

  for (const cfg of activeConfigs) {
    const match =
      cfg.entity_id === payload.device_id ||
      cfg.entity_id === payload.machine_id;
    if (!match) continue;

    const worker = workers.get(Number(cfg.id));
    if (!worker) {
      console.warn(`No worker found for config ${cfg.id}`);
      continue;
    }

    worker.postMessage({ payload, config: cfg });
  }
}

export function stopWorkers() {
  for (const [id, worker] of workers) {
    worker.terminate();
    workers.delete(id);
    logger.info(`Stopped worker ${id}`);
  }
}
