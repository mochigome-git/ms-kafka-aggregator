export interface TelemetryRecord {
  tenant_id: string;
  entity_id: string;
  device_id: string;
  machine_id: string;
  created_at: string;
  core_1: number;
  core_2: number;
  core_3: number;
  data?: Record<string, any>;
  lot_id?: string;
}
