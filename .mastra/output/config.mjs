const MEMORY_SNAPSHOTS_BUCKET = "memory-snapshots";
const MEMORY_LOCAL_ROOT = process.env.MEMORY_LOCAL_ROOT || ".data/memory-snapshots";
function getStorageMode() {
  const env = (process.env.MEMORY_STORAGE_ADAPTER || "").toLowerCase();
  if (env === "supabase") return "supabase";
  return "local";
}
function isMemoryV2Enabled() {
  const raw = process.env.MEMORY_AGENTIC_V2_ENABLED;
  const val = (raw ?? "").toString().trim().toLowerCase();
  if (!val) return true;
  if (val === "0" || val === "false" || val === "no") return false;
  return true;
}

export { MEMORY_SNAPSHOTS_BUCKET as M, MEMORY_LOCAL_ROOT as a, getStorageMode as g, isMemoryV2Enabled as i };
