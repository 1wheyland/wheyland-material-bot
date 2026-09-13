import { DateTime } from 'luxon';
export const ZONE = 'America/Los_Angeles';
export function dayWindow(date: string) {
  const start = DateTime.fromISO(date, { zone: ZONE }).startOf('day');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !start.isValid || start.toISODate() !== date) throw new Error('INVALID_DATE');
  return { date, weekday: start.weekday <= 5, after: start.toISO()!, before: start.plus({ days: 1 }).toISO()!,
    eventStart: start.set({ hour: 6 }).toISO()!, eventEnd: start.set({ hour: 6, minute: 15 }).toISO()! };
}
export const today = (now = new Date()) => DateTime.fromJSDate(now, { zone: ZONE }).toISODate()!;
export function shouldSchedule(now = new Date()) {
  const local = DateTime.fromJSDate(now, { zone: ZONE });
  return local.weekday <= 5 && local.hour === 5 && local.minute >= 45;
}
