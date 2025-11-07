import { pool } from "../config/supabase";
import { logger } from "../utils/logger";

// Enhanced connection test
export async function testConnection(
  retries = 3,
  delay = 2000
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      return true;
    } catch (error: any) {
      logger.error(
        `Connection test failed (attempt ${i + 1}/${retries}):`,
        error.message
      );
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }
  return false;
}

// Simple retry function that actually works
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error: any) {
      lastError = error;

      // Don't retry on unique constraint violations
      if (error.code === "23505") {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(
          `Operation failed (attempt ${attempt + 1}/${
            maxRetries + 1
          }). Retrying in ${delay}ms:`,
          error.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
