// Fast-lane job (Phase 2). Runs every FAST_LANE_INTERVAL_MIN minutes.
// Detects tour inquiries → proposes 3 tentative Calendar holds → drafts a warm reply →
// immediate ntfy push. This is the ROI path; it must NOT wait for a brief slot.
async function main() {
  if (process.env.KILL === "true") {
    console.log("KILL=true → no-op");
    return;
  }
  // TODO: implement after Phase 1.
  throw new Error("not implemented — gated on Phase 0 spikes + Phase 1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
