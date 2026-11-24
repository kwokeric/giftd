import type { Occasion } from "./types";

export const OCCASION_OPTIONS: { id: Occasion; label: string }[] = [
  { id: "birthday", label: "Birthday" },
  { id: "holiday", label: "Holidays" },
  { id: "anniversary", label: "Anniversary" },
  { id: "valentines", label: "Valentine's" },
  { id: "mothers_day", label: "Mother's Day" },
  { id: "fathers_day", label: "Father's Day" },
  { id: "graduation", label: "Graduation" },
  { id: "wedding", label: "Wedding" },
  { id: "housewarming", label: "Housewarming" },
  { id: "thank_you", label: "Thank you" },
  { id: "just_because", label: "Just because" },
];

/** nth weekday (0=Sun) of a month, e.g. 2nd Sunday of May. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** Pre-selects the occasion from the calendar. Birthday the rest of the year. */
export function defaultOccasion(now: Date = new Date()): Occasion {
  const m = now.getMonth(); // 0-based
  const d = now.getDate();
  const y = now.getFullYear();
  if ((m === 10 && d >= 15) || m === 11) return "holiday"; // Nov 15 – Dec 31
  if (m === 1 && d <= 14) return "valentines";
  const mothersDay = nthWeekday(y, 4, 0, 2);
  if (m === 4 && d <= mothersDay && d >= mothersDay - 14) return "mothers_day";
  const fathersDay = nthWeekday(y, 5, 0, 3);
  if (m === 5 && d <= fathersDay && d >= fathersDay - 14) return "fathers_day";
  return "birthday";
}
