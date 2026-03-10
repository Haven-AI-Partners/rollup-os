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
