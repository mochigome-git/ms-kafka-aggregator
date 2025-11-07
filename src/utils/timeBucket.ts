import dayjs from "dayjs";

export function calculateBucketStart(
  datetime: string,
  level: string | null
): string {
  const d = dayjs(datetime);
  switch (level) {
    case "second":
      return d.startOf("second").toISOString();
    case "minute":
      return d.startOf("minute").toISOString();
    case "hour":
      return d.startOf("hour").toISOString();
    case "day":
      return d.startOf("day").toISOString();
    default:
      return d.toISOString();
  }
}
