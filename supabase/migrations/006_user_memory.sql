-- Removed in Memory v2 baseline. The file-first snapshots + events ledger replaces JSON-Patch memory.
-- Keeping this filename in place to avoid re-numbering migration history.

DROP TABLE IF EXISTS user_memory_snapshots CASCADE;
