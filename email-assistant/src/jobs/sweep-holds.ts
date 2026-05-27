import { authedClient } from "../google/auth.js";
import { calendarClient, listOurHolds, deleteEvent } from "../google/calendar.js";
import { listPendingHolds, markHold } from "../store/holds.js";
import { HOLD_TTL_HOURS } from "../config/schedule.js";

async function main() {
  if (process.env.KILL === "true") return;
  const calendarId = process.env.BUSINESS_CALENDAR_ID || "primary";
  const auth = authedClient();
  const cal = calendarClient(auth);

  // Sweep 1: any Firestore-tracked pending hold past TTL → delete all 3 events, then mark
  // expired. Mark per-hold immediately so a crash mid-loop doesn't leave Firestore lying
  // about state (red-team fix #1H).
  const cutoff = new Date(Date.now() - HOLD_TTL_HOURS * 60 * 60_000);
  const pending = await listPendingHolds();
  let removed = 0;
  for (const hold of pending) {
    if (new Date(hold.createdAt) > cutoff) continue;
    for (const eventId of hold.holdIds) {
      try {
        await deleteEvent(cal, hold.calendarId, eventId);
        removed++;
      } catch (e) {
        console.warn(`sweep: failed to delete ${eventId}`, e);
      }
    }
    try {
      await markHold(hold.inquiryThreadId, { status: "expired" });
    } catch (e) {
      console.warn(`sweep: failed to mark expired ${hold.inquiryThreadId}`, e);
    }
  }

  // Sweep 2: belt-and-suspenders — any tentative event we created that's older than TTL but
  // not tracked in Firestore (e.g. record lost). Delete it.
  const orphans = await listOurHolds(cal, calendarId, cutoff);
  for (const e of orphans) {
    if (!e.id) continue;
    try {
      await deleteEvent(cal, calendarId, e.id);
      removed++;
    } catch (err) {
      console.warn(`sweep: failed to delete orphan ${e.id}`, err);
    }
  }

  console.log(`sweep-holds: removed ${removed} stale hold events`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
