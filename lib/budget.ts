const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta, UTC+7, no daylight saving

/** ISO timestamp of the first moment of the current month in WIB: when monthly budgets reset. */
export function startOfMonthWib(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MS);
  const monthStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  return new Date(monthStart - WIB_OFFSET_MS).toISOString();
}

/** ISO timestamp of the start of the current day in WIB. */
export function startOfDayWib(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MS);
  const dayStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(dayStart - WIB_OFFSET_MS).toISOString();
}

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}
