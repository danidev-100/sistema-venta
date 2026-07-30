/**
 * Format a number as currency in Argentine format.
 *
 * Examples:
 *   formatCurrency(1500)       → "$1.500,00"
 *   formatCurrency(1234.5)     → "$1.234,50"
 *   formatCurrency(99.99)      → "$99,99"
 *   formatCurrency(0)          → "$0,00"
 *   formatCurrency(-50.5)      → "-$50,50"
 */
export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Format a number in Argentine locale (with thousands separator).
 *
 * Examples:
 *   formatNumber(1500)       → "1.500"
 *   formatNumber(0.5)        → "0,5"
 */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
