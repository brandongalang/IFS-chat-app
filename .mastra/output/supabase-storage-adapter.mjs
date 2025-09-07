import { createClient } from '@supabase/supabase-js';
import { M as MEMORY_SNAPSHOTS_BUCKET } from './config.mjs';

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) throw new Error("Supabase Storage adapter requires URL and service role key");
  return createClient(url, service);
}
class SupabaseStorageAdapter {
  async putText(path, text, opts) {
    const sb = getSb();
    const { error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET).upload(path, new Blob([text], { type: opts?.contentType || "text/plain; charset=utf-8" }), { upsert: true });
    if (error) throw error;
  }
  async getText(path) {
    const sb = getSb();
    const { data, error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET).download(path);
    if (error) return null;
    return await data.text();
  }
  async exists(path) {
    const sb = getSb();
    const parent = path.split("/").slice(0, -1).join("/");
    const name = path.split("/").slice(-1)[0];
    const { data, error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET).list(parent || void 0, { search: name });
    if (error) return false;
    return (data || []).some((f) => f.name === name);
  }
  async list(prefix) {
    const sb = getSb();
    const { data, error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET).list(prefix || void 0);
    if (error || !data) return [];
    return data.map((d) => `${prefix ? prefix.replace(/\/?$/, "/") : ""}${d.name}`);
  }
  async delete(path) {
    const sb = getSb();
    const { error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET).remove([path]);
    if (error) throw error;
  }
}

export { SupabaseStorageAdapter };
