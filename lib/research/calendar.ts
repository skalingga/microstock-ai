// Event calendar for theme research. Plain data so it is easy to edit (PRD: "bisa diedit").
// Movable feasts (lunar and religious dates) are approximate and listed per year; check them
// against an official calendar before relying on an upload deadline.

export type RegionId = "global" | "US" | "GB" | "DE" | "FR" | "ID" | "JP" | "IN" | "BR" | "AU" | "CA";

export const REGIONS: { value: RegionId; label: string; trendsGeo: string }[] = [
  { value: "global", label: "Dunia", trendsGeo: "" },
  { value: "US", label: "Amerika Serikat", trendsGeo: "US" },
  { value: "GB", label: "Inggris", trendsGeo: "GB" },
  { value: "DE", label: "Jerman", trendsGeo: "DE" },
  { value: "FR", label: "Prancis", trendsGeo: "FR" },
  { value: "ID", label: "Indonesia", trendsGeo: "ID" },
  { value: "JP", label: "Jepang", trendsGeo: "JP" },
  { value: "IN", label: "India", trendsGeo: "IN" },
  { value: "BR", label: "Brasil", trendsGeo: "BR" },
  { value: "AU", label: "Australia", trendsGeo: "AU" },
  { value: "CA", label: "Kanada", trendsGeo: "CA" },
];

export type CalendarEvent = {
  name: string;
  /** Regions where the event matters; "all" means every region. */
  regions: RegionId[] | "all";
  /** 1 (minor) to 3 (major stock-demand peak). */
  weight: 1 | 2 | 3;
  /** Date in the given year as "MM-DD", or null when the event has no date that year. */
  dateIn: (year: number) => string | null;
};

const fixed = (md: string) => () => md;
const byYear = (dates: Record<number, string>) => (year: number) => dates[year] ?? null;

/** n-th weekday (0 = Sunday) of a month, as "MM-DD". */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const CALENDAR: CalendarEvent[] = [
  { name: "New Year", regions: "all", weight: 3, dateIn: fixed("01-01") },
  { name: "Chinese New Year", regions: ["global", "US", "ID", "JP", "AU", "CA", "GB"], weight: 3, dateIn: byYear({ 2027: "02-06", 2028: "01-26", 2029: "02-13" }) },
  { name: "Valentine's Day", regions: "all", weight: 3, dateIn: fixed("02-14") },
  { name: "Ramadan", regions: ["global", "ID", "IN", "GB", "FR", "DE"], weight: 3, dateIn: byYear({ 2027: "02-08", 2028: "01-28", 2029: "01-16" }) },
  { name: "Eid al-Fitr", regions: ["global", "ID", "IN", "GB", "FR", "DE"], weight: 3, dateIn: byYear({ 2027: "03-09", 2028: "02-26", 2029: "02-14" }) },
  { name: "St. Patrick's Day", regions: ["global", "US", "GB", "CA", "AU"], weight: 2, dateIn: fixed("03-17") },
  { name: "Easter", regions: ["global", "US", "GB", "DE", "FR", "BR", "AU", "CA"], weight: 3, dateIn: byYear({ 2027: "03-28", 2028: "04-16", 2029: "04-01" }) },
  { name: "Earth Day", regions: "all", weight: 2, dateIn: fixed("04-22") },
  { name: "Mother's Day", regions: ["US", "CA", "AU", "JP", "BR", "IN"], weight: 2, dateIn: (y) => nthWeekday(y, 5, 0, 2) },
  { name: "Summer holidays", regions: "all", weight: 3, dateIn: fixed("06-21") },
  { name: "Father's Day", regions: ["US", "CA", "GB", "IN"], weight: 1, dateIn: (y) => nthWeekday(y, 6, 0, 3) },
  { name: "Independence Day (USA)", regions: ["US"], weight: 2, dateIn: fixed("07-04") },
  { name: "Independence Day (Indonesia)", regions: ["ID"], weight: 2, dateIn: fixed("08-17") },
  { name: "Back to school", regions: "all", weight: 3, dateIn: fixed("09-01") },
  { name: "Autumn season", regions: ["global", "US", "GB", "DE", "FR", "JP", "CA"], weight: 3, dateIn: fixed("09-22") },
  { name: "Halloween", regions: ["global", "US", "GB", "CA", "AU", "FR", "DE"], weight: 3, dateIn: fixed("10-31") },
  { name: "Diwali", regions: ["global", "IN", "US", "GB", "CA", "AU"], weight: 3, dateIn: byYear({ 2026: "11-08", 2027: "10-29", 2028: "11-17", 2029: "11-05" }) },
  { name: "Black Friday", regions: "all", weight: 3, dateIn: (y) => {
      const [m, d] = nthWeekday(y, 11, 4, 4).split("-").map(Number);
      return `${String(m).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
    } },
  { name: "Thanksgiving", regions: ["US", "CA"], weight: 3, dateIn: (y) => nthWeekday(y, 11, 4, 4) },
  { name: "Christmas", regions: "all", weight: 3, dateIn: fixed("12-25") },
];

/** Upload this many days before an event; stock buyers search 2-3 months ahead (PRD assumption). */
export const UPLOAD_LEAD_DAYS = 75;

export type UpcomingEvent = { name: string; date: string; weight: 1 | 2 | 3; uploadBy: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Events for a region whose date falls between start and end (inclusive), soonest first. */
export function eventsInPeriod(region: RegionId, start: Date, end: Date, calendar: CalendarEvent[] = CALENDAR): UpcomingEvent[] {
  const result: UpcomingEvent[] = [];
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
    for (const event of calendar) {
      if (event.regions !== "all" && !event.regions.includes(region) && region !== "global") continue;
      const md = event.dateIn(year);
      if (!md) continue;
      const date = new Date(`${year}-${md}T00:00:00Z`);
      if (date < start || date > end) continue;
      const uploadBy = new Date(date.getTime() - UPLOAD_LEAD_DAYS * 86_400_000);
      result.push({ name: event.name, date: iso(date), weight: event.weight, uploadBy: iso(uploadBy) });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
