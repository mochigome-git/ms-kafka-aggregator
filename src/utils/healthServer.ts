import express, { Request, Response } from "express";
import { testConnection } from "../db/connection";
import { checkKafka } from "../services/kafkaService";
import { checkConfigWatcher } from "../realtime/configWatcher";
import { logger } from "./logger";

export async function startHealthServer(port = 8080) {
  const app = express();

  app.get("/health", async (req: Request, res: Response) => {
    try {
      const dbHealthy = await testConnection(1, 1000);
      const kafkaHealthy = checkKafka();
      const watcherHealthy = checkConfigWatcher();

      const allHealthy = dbHealthy && kafkaHealthy && watcherHealthy;

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        database: dbHealthy ? "connected" : "disconnected",
        kafka: kafkaHealthy ? "connected" : "disconnected",
        configWatcher: watcherHealthy ? "running" : "stopped",
      });
    } catch (error: any) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "error",
        error: error.message,
      });
    }
  });

  app.get("/ready", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  });

  const server = app.listen(port, () => {
    logger.info(`Health check server running on port ${port}`);
  });

  return server;
}
