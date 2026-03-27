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

/** Format a date as a relative time string (e.g., "2 hours ago", "5 minutes ago") */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

/** Format a duration in milliseconds to human-readable (e.g., "5m 30s") */
export function formatDuration(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${secs}s`;
}

/** Format JPY using Japanese units (億, 万) */
function formatJPY(num: number): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_0000_0000) {
    const oku = abs / 1_0000_0000;
    return `${sign}¥${oku % 1 === 0 ? oku.toFixed(0) : oku.toFixed(1)}億`;
  }
  if (abs >= 1_0000) {
    const man = abs / 1_0000;
    return `${sign}¥${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}万`;
  }
  return `${sign}¥${abs.toLocaleString("en-US")}`;
}

/** Format a numeric value with the appropriate currency symbol */
export function formatCurrency(value: string | number | null, currency?: string | null): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (isNaN(num)) return "—";

  const code = currency ?? "JPY";

  if (code === "JPY") return formatJPY(num);

  try {
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
