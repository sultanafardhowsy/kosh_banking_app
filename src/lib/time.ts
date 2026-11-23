/** Bank days run on Bangladesh time (UTC+6, no DST). */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the current Dhaka calendar day, as a UTC Date. Daily limits reset here. */
export function startOfDhakaDay(now = new Date()) {
  const local = now.getTime() + DHAKA_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - DHAKA_OFFSET_MS);
}

export const minutesAgo = (m: number, now = new Date()) => new Date(now.getTime() - m * 60_000);
export const daysAgo = (d: number, now = new Date()) => new Date(now.getTime() - d * DAY_MS);
