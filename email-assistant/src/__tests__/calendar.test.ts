import { test } from "node:test";
import assert from "node:assert/strict";
import { proposeSlots } from "../google/calendar.js";

// THE big red-team bug: server-local vs business-tz. These tests pin the fix.

test("proposeSlots respects business hours in the BUSINESS timezone (LA)", () => {
  // 1000Z on a Monday → 03:00 LA (off-hours). 1700Z → 10:00 LA (on-hours).
  // Walk a week from a known Monday at 00:00Z.
  const from = new Date("2026-06-01T00:00:00Z"); // Monday
  const to = new Date("2026-06-05T00:00:00Z"); // Friday
  const slots = proposeSlots([], {
    from,
    to,
    durationMin: 30,
    count: 3,
    businessStartHourLocal: 9,
    businessEndHourLocal: 17,
    timeZone: "America/Los_Angeles",
  });
  assert.equal(slots.length, 3);
  for (const slot of slots) {
    const hour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        hour12: false,
      })
        .formatToParts(new Date(slot.start))
        .find((p) => p.type === "hour")?.value ?? "0",
      10,
    );
    assert.ok(hour >= 9 && hour < 17, `slot ${slot.start} should be 9–17 LA, got hour ${hour}`);
  }
});

test("proposeSlots skips weekends by default", () => {
  // From a Saturday — should land on Monday 09:00 LA at earliest.
  const from = new Date("2026-06-06T00:00:00Z"); // Saturday
  const to = new Date("2026-06-10T00:00:00Z");
  const slots = proposeSlots([], {
    from,
    to,
    durationMin: 30,
    count: 3,
    businessStartHourLocal: 9,
    businessEndHourLocal: 17,
    timeZone: "America/Los_Angeles",
  });
  for (const slot of slots) {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short",
    }).format(new Date(slot.start));
    assert.notEqual(weekday, "Sat");
    assert.notEqual(weekday, "Sun");
  }
});

test("proposeSlots avoids busy intervals", () => {
  const from = new Date("2026-06-01T16:00:00Z"); // Monday 09:00 LA
  const to = new Date("2026-06-01T22:00:00Z"); // Monday 15:00 LA
  // Block 09:00–11:00 LA exactly
  const busy = [{ start: "2026-06-01T16:00:00Z", end: "2026-06-01T18:00:00Z" }];
  const slots = proposeSlots(busy, {
    from,
    to,
    durationMin: 30,
    count: 2,
    businessStartHourLocal: 9,
    businessEndHourLocal: 17,
    timeZone: "America/Los_Angeles",
  });
  for (const slot of slots) {
    const startMs = new Date(slot.start).getTime();
    const endMs = new Date(slot.end).getTime();
    const busyS = new Date(busy[0]!.start).getTime();
    const busyE = new Date(busy[0]!.end).getTime();
    assert.ok(endMs <= busyS || startMs >= busyE, `slot ${slot.start}–${slot.end} collides with busy`);
  }
});

test("proposeSlots spaces results at least 2h apart", () => {
  // 4-day window so 3 distinct slots are guaranteed available.
  const from = new Date("2026-06-01T15:00:00Z"); // Monday 08:00 LA
  const to = new Date("2026-06-05T00:00:00Z"); // Thursday 17:00 LA
  const slots = proposeSlots([], {
    from,
    to,
    durationMin: 30,
    count: 3,
    businessStartHourLocal: 9,
    businessEndHourLocal: 17,
    timeZone: "America/Los_Angeles",
  });
  assert.equal(slots.length, 3, "must return 3 slots or the spacing assertion is vacuous");
  for (let i = 1; i < slots.length; i++) {
    const dt =
      new Date(slots[i]!.start).getTime() - new Date(slots[i - 1]!.start).getTime();
    assert.ok(dt >= 2 * 60 * 60_000, `slots ${i - 1} and ${i} are <2h apart`);
  }
});
