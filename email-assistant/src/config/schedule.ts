// Brief cadence + fast-lane settings. Times are local to the business timezone.
// Fixed times misfire for a field-based operator (no signal on the island, peak weekends,
// DST). Keep them here so they're trivial to tune, and never let the urgent path wait for a
// slot — that's what the fast lane is for.

export const BUSINESS_TZ = "America/Los_Angeles"; // TODO: confirm

// 5 brief slots/day (24h local). Weekends can override (peak business days).
export const BRIEF_SLOTS_WEEKDAY = ["07:30", "11:00", "13:30", "16:30", "20:00"];
export const BRIEF_SLOTS_WEEKEND = ["08:30", "12:00", "16:00", "20:00"];

// Fast lane: how often to scan for tour inquiries.
export const FAST_LANE_INTERVAL_MIN = 5;

// Gmail query for the fast lane (business account). Tightened later with real signals.
export const TOUR_INQUIRY_QUERY = "in:inbox is:unread newer_than:1d";

// Tentative holds expire if the guest doesn't confirm.
export const HOLD_TTL_HOURS = 24;
