# Memory v2 Cutover (No Backfill)

We intentionally cut over to Memory v2 without backfilling historical snapshots.

What this means
- Snapshots (overview, part profiles, relationship profiles) begin at the cutover date.
- Historical narrative prior to the cutover won’t be present in file-first snapshots.
- Structured event logging (events ledger) is the source of truth going forward.

Why we chose this
- Simplicity and speed: avoids a large, error-prone backfill.
- Clear separation from legacy constructs.

Operational notes
- Feature flag: MEMORY_AGENTIC_V2_ENABLED defaults ON. You can still explicitly disable it (0/false/no) for one release window if needed.
- Observability: snapshot hit/miss/error rates and latency are logged (see memory-observability.md).
- First reads may show “miss” until snapshots are created or updated; this is expected and non-fatal.

If you later want history
- You can implement an on-demand backfill for a specific user/part/relationship, or a batch backfill script, but this is not required for normal operation.

