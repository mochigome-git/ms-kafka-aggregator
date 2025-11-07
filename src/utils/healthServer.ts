// utils/healthServer.ts
import express, { Request, Response } from "express";
import { testConnection } from "../db/connection";
import { logger } from "./logger";

export function startHealthServer(port = 8080) {
  const app = express();

  app.get("/health", async (req: Request, res: Response) => {
    try {
      const dbHealthy = await testConnection(1, 1000);

      if (dbHealthy) {
        res.status(200).json({
          status: "healthy",
          timestamp: new Date().toISOString(),
          database: "connected",
        });
      } else {
        res.status(503).json({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          database: "disconnected",
        });
      }
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
