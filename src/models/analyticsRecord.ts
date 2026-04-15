export interface FastAggregatedItem {
  tenant_id: string;
  device_id?: string;
  machine_id?: string;
  created_at: Date;
  count: number;
  sum1: number;
  sum2: number;
  sum3: number;
  data?: any;
  lot_id?: string;
}
