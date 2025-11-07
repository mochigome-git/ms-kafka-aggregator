import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_KEY: process.env.SUPABASE_KEY!,
  KAFKA_BROKER: process.env.KAFKA_BROKER!,
  KAFKA_TOPIC: process.env.KAFKA_TOPIC!,
  KAFKA_CA_CERT_PATH: process.env.KAFKA_CA_CERT_PATH!,
};
