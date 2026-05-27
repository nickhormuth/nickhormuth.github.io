export const CATEGORIES = [
  "tour_inquiry", // hot-lead, fast-lane path
  "client_request", // existing customer needs a reply
  "scheduling", // confirms, reschedules
  "receipt", // expense receipts (Phase 3)
  "newsletter",
  "promotional",
  "security_alert",
  "personal",
  "team_internal",
  "spam",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const IMPORTANCE = ["high", "medium", "low", "none"] as const;
export type Importance = (typeof IMPORTANCE)[number];

export const LABEL_FOR: Record<Category, string> = {
  tour_inquiry: "AI/Tour-inquiry",
  client_request: "AI/Needs-reply",
  scheduling: "AI/Scheduling",
  receipt: "AI/Receipt",
  newsletter: "AI/Newsletter",
  promotional: "AI/Promo",
  security_alert: "AI/Security",
  personal: "AI/Personal",
  team_internal: "AI/Internal",
  spam: "AI/Spam",
  other: "AI/FYI",
};
