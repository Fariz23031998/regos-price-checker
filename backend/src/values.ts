export type Row = Record<string, unknown>;

export function field(row: Row, name: string): unknown {
  if (name in row) return row[name];
  const upper = name.toUpperCase();
  if (upper in row) return row[upper];
  const lower = name.toLowerCase();
  if (lower in row) return row[lower];
  return undefined;
}

export function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (Buffer.isBuffer(value)) return value.toString("utf8").trim();
  return String(value).trim();
}

export function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "bigint") return Number(value);
  const numeric = typeof value === "number" ? value : Number(asText(value));
  return Number.isFinite(numeric) ? numeric : null;
}

export function asInt(value: unknown): number | null {
  const numeric = asNumber(value);
  return numeric == null ? null : Math.trunc(numeric);
}

export function asTimestamp(value: unknown): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}
