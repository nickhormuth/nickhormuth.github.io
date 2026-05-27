import { google, calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type CalendarClient = calendar_v3.Calendar;

export function calendarClient(auth: OAuth2Client): CalendarClient {
  return google.calendar({ version: "v3", auth });
}

export interface BusySlot {
  start: string; // ISO
  end: string; // ISO
}

export async function freeBusy(
  cal: CalendarClient,
  calendarId: string,
  from: Date,
  to: Date,
  timeZone: string,
): Promise<BusySlot[]> {
  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      timeZone,
      items: [{ id: calendarId }],
    },
  });
  const busy = res.data.calendars?.[calendarId]?.busy ?? [];
  return busy.map((b) => ({ start: b.start!, end: b.end! }));
}

// Propose N candidate slots, each `durationMin` long, within business hours, that don't
// collide with busy. Skips weekends unless allowWeekends.
export function proposeSlots(
  busy: BusySlot[],
  opts: {
    from: Date;
    to: Date;
    durationMin: number;
    count: number;
    businessStartHourLocal: number; // e.g. 9
    businessEndHourLocal: number; // e.g. 17
    timeZone: string; // for hour interpretation; uses local-time approximation
    allowWeekends?: boolean;
  },
): BusySlot[] {
  const out: BusySlot[] = [];
  const stepMs = 30 * 60_000; // 30-min grid
  const durMs = opts.durationMin * 60_000;
  const busySorted = [...busy]
    .map((b) => ({ s: new Date(b.start).getTime(), e: new Date(b.end).getTime() }))
    .sort((a, b) => a.s - b.s);

  const collidesWithBusy = (s: number, e: number) =>
    busySorted.some((b) => !(b.e <= s || b.s >= e));

  for (let t = opts.from.getTime(); t + durMs <= opts.to.getTime() && out.length < opts.count; t += stepMs) {
    const start = new Date(t);
    const end = new Date(t + durMs);
    // crude business-hour check (server local; refine with Intl in v1.1)
    const hr = start.getHours();
    const day = start.getDay();
    if (!opts.allowWeekends && (day === 0 || day === 6)) continue;
    if (hr < opts.businessStartHourLocal || hr >= opts.businessEndHourLocal) continue;
    if (collidesWithBusy(start.getTime(), end.getTime())) continue;
    // Space proposed slots at least 2h apart from each other for guest choice
    if (out.some((p) => Math.abs(new Date(p.start).getTime() - start.getTime()) < 2 * 60 * 60_000))
      continue;
    out.push({ start: start.toISOString(), end: end.toISOString() });
  }
  return out;
}

export interface HoldInput {
  calendarId: string;
  summary: string;
  description?: string;
  start: string; // ISO
  end: string; // ISO
  timeZone: string;
}

export async function insertTentativeHold(
  cal: CalendarClient,
  h: HoldInput,
): Promise<{ eventId: string }> {
  const res = await cal.events.insert({
    calendarId: h.calendarId,
    requestBody: {
      summary: h.summary,
      description: h.description,
      start: { dateTime: h.start, timeZone: h.timeZone },
      end: { dateTime: h.end, timeZone: h.timeZone },
      status: "tentative",
      transparency: "opaque",
      extendedProperties: { private: { source: "inbox-copilot", kind: "tour-inquiry-hold" } },
    },
  });
  return { eventId: res.data.id! };
}

export async function confirmHold(
  cal: CalendarClient,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await cal.events.patch({
    calendarId,
    eventId,
    requestBody: { status: "confirmed" },
  });
}

export async function deleteEvent(cal: CalendarClient, calendarId: string, eventId: string): Promise<void> {
  await cal.events.delete({ calendarId, eventId });
}

export async function listOurHolds(
  cal: CalendarClient,
  calendarId: string,
  olderThan: Date,
): Promise<calendar_v3.Schema$Event[]> {
  const res = await cal.events.list({
    calendarId,
    privateExtendedProperty: ["source=inbox-copilot", "kind=tour-inquiry-hold"],
    showDeleted: false,
    maxResults: 250,
  });
  return (res.data.items ?? []).filter((e) => {
    const created = e.created ? new Date(e.created) : null;
    return e.status === "tentative" && created !== null && created < olderThan;
  });
}
