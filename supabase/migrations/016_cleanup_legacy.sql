-- Memory v2 cleanup: remove legacy tables if present
DROP TABLE IF EXISTS agent_actions CASCADE;
DROP TABLE IF EXISTS user_memory_snapshots CASCADE;

