import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_KEY: process.env.SUPABASE_KEY!,
  KAFKA_BROKER: process.env.KAFKA_BROKER!,
  KAFKA_TOPIC: process.env.KAFKA_TOPIC!,
  KAFKA_CA_CERT: process.env.KAFKA_CA_CERT!,

  // Build PostgreSQL connection string from individual parts
  SUPABASE_CA_CERT: process.env.SUPABASE_CA_CERT!,
  SUPABASE_DB_URL: `postgresql://${process.env.SUPABASE_DB_USER}:${process.env.SUPABASE_DB_PASSWORD}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`,

  // Log
  LOG_SUMMARY_TIMER: Number(process.env.LOG_SUMMARY_TIMER),
};
