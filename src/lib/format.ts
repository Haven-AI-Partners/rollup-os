/** Format a date with short month, day, hour, and minute (e.g., "Mar 24, 02:30 PM") */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a date to short format (e.g., "Mar 24") */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Format a duration in milliseconds to human-readable (e.g., "5m 30s") */
export function formatDuration(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${secs}s`;
}

/** Format a numeric value with the appropriate currency symbol */
export function formatCurrency(value: string | number | null, currency?: string | null): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num)) return "—";

  const code = currency ?? "JPY";

  try {
    // For JPY, no decimal places. For others, 0 decimals for large values.
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    // Fallback for unknown currency codes
    return `${code} ${num.toLocaleString()}`;
  }
}
