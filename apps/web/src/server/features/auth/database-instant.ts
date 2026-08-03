export function databaseInstant(value: unknown, label: string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${label} returned an invalid database timestamp.`);
  }
  return parsed;
}
