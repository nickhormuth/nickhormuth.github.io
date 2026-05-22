// Phase 0 spike (c): prove the propose-3-times mechanic end to end.
// NOTE: Google has no public API to create "Appointment Schedules" (booking links come from
// the Calendar web UI only). So we do NOT use booking links. Instead we propose 3 concrete
// free/busy slots as tentative events the guest confirms by reply — fully automatable, no
// double-booking.
//
// TODO:
//  1. calendar.freebusy.query over the next N business days → find 3 open slots.
//  2. events.insert ×3 with status:"tentative", summary:"HOLD: tour inquiry — {name}".
//  3. On a reply choosing one, confirm it (status:"confirmed") and delete the other two holds.
//  4. Sweep: delete any tentative hold older than HOLD_TTL_HOURS with no confirmation.
export {};
