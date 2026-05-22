// Batched brief job (Phase 1). Runs at each configured slot.
// Pipeline: cursor-fetch new mail → triage (Haiku) → draft important (Opus) → apply AI/* labels
// → compose brief (Opus) → deliver via email-to-self + ntfy.
// Every label change is enumerated in the brief so nothing happens silently.
//
// Robustness (built in from day one): never trust historyId alone — fall back to a
// date-bounded messages.list and dedupe against the processed-message-id set in Firestore.
async function main() {
  if (process.env.KILL === "true") {
    console.log("KILL=true → no-op");
    return;
  }
  // TODO: implement once Phase 0 spikes pass.
  throw new Error("not implemented — gated on Phase 0 spikes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
