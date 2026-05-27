# Firestore schema

Database: `(default)` (Firestore Native mode) in the same region as Cloud Run.

## Collections

### `cursor/{account}`
Per-account run cursor. v1 has one doc: `business`.
- `lastRunAt` — ISO string
- `lastHistoryId?` — Gmail history id (advisory; we always also use the date-bounded fallback)

### `processed/{gmail_message_id}`
Idempotency set — one doc per message we've handled (either lane).
- `processedAt` — ISO string

### `holds/{thread_id}`
Tour-inquiry hold registry.
- `inquiryMessageId`, `inquiryThreadId`, `inquirerEmail`, `inquirerName?`
- `calendarId`
- `holdIds[]` — calendar event ids (all 3)
- `proposedSlots[]` — `{ start, end }`
- `createdAt` — ISO
- `status` — `"pending" | "confirmed" | "expired"`
- `confirmedSlot?`, `confirmedEventId?`

### `receipts/{gmail_message_id}` (Phase 3)
- `vendor, amount, currency, category, payment_method, drive_link, confidence, sheetRow`

### `sender_stats/{sender_domain}` (Phase 3, unsubscribe candidates)
- `sent, opened, lastSeen, unsubFiredAt?`

### `audit/{auto_id}`
Every action with side-effects.
- `at`, `actor` (`"system"` always in v1), `kind`, `details{}`

## Indexes

None required for v1 — single-collection equality queries only.
