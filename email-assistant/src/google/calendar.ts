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

// Propose N candidate slots, each `durationMin` long, within business hours in the GIVEN
// timezone (not the server's). Cloud Run is UTC — using server-local hours would propose 2 AM
// slots. We resolve hours/weekday via Intl in `timeZone`.
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function localParts(d: Date, timeZone: string): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  // Intl returns "24" for midnight in some locales; normalize.
  const hour = (parseInt(hourStr, 10) || 0) % 24;
  const weekday = WEEKDAY_INDEX[weekdayStr] ?? 1;
  return { hour, weekday };
}

export function proposeSlots(
  busy: BusySlot[],
  opts: {
    from: Date;
    to: Date;
    durationMin: number;
    count: number;
    businessStartHourLocal: number; // e.g. 9
    businessEndHourLocal: number; // e.g. 17
    timeZone: string; // business timezone — slots are evaluated here, not server-local
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
    const { hour, weekday } = localParts(start, opts.timeZone);
    if (!opts.allowWeekends && (weekday === 0 || weekday === 6)) continue;
    if (hour < opts.businessStartHourLocal || hour >= opts.businessEndHourLocal) continue;
    if (collidesWithBusy(start.getTime(), start.getTime() + durMs)) continue;
    // Space proposed slots at least 2h apart from each other for guest choice
    if (out.some((p) => Math.abs(new Date(p.start).getTime() - start.getTime()) < 2 * 60 * 60_000))
      continue;
    out.push({ start: start.toISOString(), end: new Date(t + durMs).toISOString() });
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
