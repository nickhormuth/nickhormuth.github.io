// Phase 0 spike (c): prove the propose-3-times mechanic end to end.
//
// Run:  npm run calendar:spike
//
// Reads free/busy for the next 7 days on BUSINESS_CALENDAR_ID, proposes 3 slots, inserts 3
// tentative ("HOLD") events, prints their event IDs. Then run with --confirm <eventId> to
// confirm one (deletes the others), or --sweep to delete all holds older than the TTL.

import { authedClient } from "../google/auth.js";
import {
  calendarClient,
  freeBusy,
  proposeSlots,
  insertTentativeHold,
  confirmHold,
  deleteEvent,
  listOurHolds,
} from "../google/calendar.js";
import { BUSINESS_TZ, HOLD_TTL_HOURS } from "../config/schedule.js";

async function main() {
  const calendarId = process.env.BUSINESS_CALENDAR_ID || "primary";
  const auth = authedClient();
  const cal = calendarClient(auth);

  const mode = process.argv[2] ?? "place";

  if (mode === "place") {
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60_000);
    const busy = await freeBusy(cal, calendarId, now, horizon, BUSINESS_TZ);
    const slots = proposeSlots(busy, {
      from: new Date(now.getTime() + 60 * 60_000),
      to: horizon,
      durationMin: 30,
      count: 3,
      businessStartHourLocal: 9,
      businessEndHourLocal: 17,
      timeZone: BUSINESS_TZ,
    });
    console.log(`proposed slots:`, slots);
    if (slots.length < 3) {
      console.warn("not enough availability");
      return;
    }
    const ids: string[] = [];
    for (const s of slots) {
      const h = await insertTentativeHold(cal, {
        calendarId,
        summary: "HOLD: spike test",
        description: "calendar-holds spike — safe to ignore or delete",
        start: s.start,
        end: s.end,
        timeZone: BUSINESS_TZ,
      });
      ids.push(h.eventId);
    }
    console.log(`placed 3 holds:\n${ids.map((id) => `  ${id}`).join("\n")}`);
    console.log(`\nConfirm one:  npm run calendar:spike -- confirm <eventId> <otherId1> <otherId2>`);
    console.log(`Sweep stale:  npm run calendar:spike -- sweep`);
    return;
  }

  if (mode === "confirm") {
    const eventId = process.argv[3];
    const others = process.argv.slice(4);
    if (!eventId) throw new Error("eventId required");
    await confirmHold(cal, calendarId, eventId);
    for (const o of others) await deleteEvent(cal, calendarId, o);
    console.log(`confirmed ${eventId}, deleted ${others.length} others`);
    return;
  }

  if (mode === "sweep") {
    const cutoff = new Date(Date.now() - HOLD_TTL_HOURS * 60 * 60_000);
    const stale = await listOurHolds(cal, calendarId, cutoff);
    for (const e of stale) {
      if (e.id) await deleteEvent(cal, calendarId, e.id);
    }
    console.log(`swept ${stale.length} stale holds`);
    return;
  }

  console.error(`unknown mode: ${mode}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
