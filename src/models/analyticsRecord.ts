export interface FastAggregatedItem {
  tenant_id: string;
  device_id?: string;
  machine_id?: string;
  bucket_start: Date;
  count: number;
  sum1: number;
  sum2: number;
  sum3: number;
  data?: any;
  lot_id?: string;
}
