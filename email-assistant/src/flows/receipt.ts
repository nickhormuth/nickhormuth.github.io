// Phase 3 — receipt extractor.
// Detect category == "receipt" mail, extract structured fields with Opus, append a row to a
// Google Sheet, save the PDF/HTML to Drive, link it.
//
// Schema for the sheet:
//   date | vendor | amount | currency | category | business_or_personal | payment_method |
//   gmail_message_id | drive_link | confidence
//
// Only rows with confidence >= 0.8 land in the sheet; lower-confidence ones are queued in the
// brief under "Confirm these receipts".

export {};
