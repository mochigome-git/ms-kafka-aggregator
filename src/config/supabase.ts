// config/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";
import { Pool, PoolConfig } from "pg";
import fs from "fs";

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

const poolConfig: PoolConfig = {
  connectionString: ENV.SUPABASE_DB_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: ENV.SUPABASE_CA_CERT
      ? [fs.readFileSync(ENV.SUPABASE_CA_CERT, "utf-8")]
      : undefined,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

export const pool = new Pool(poolConfig);
