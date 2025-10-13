import { createClient } from '@supabase/supabase-js'
import type { StorageAdapter } from './adapter'
import { MEMORY_SNAPSHOTS_BUCKET } from '../config'
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/config'

function getSb() {
  const url = getSupabaseUrl()
  const service = getSupabaseServiceRoleKey()
  if (!url || !service) throw new Error('Supabase Storage adapter requires URL and service role key')
  return createClient(url, service)
}

export class SupabaseStorageAdapter implements StorageAdapter {
  async putText(path: string, text: string, opts?: { contentType?: string }): Promise<void> {
    const sb = getSb()
    const { error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET)
      .upload(path, new Blob([text], { type: opts?.contentType || 'text/plain; charset=utf-8' }), { upsert: true })
    if (error) throw error
  }
  async getText(path: string): Promise<string | null> {
    const sb = getSb()
    const { data, error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET).download(path)
    if (error) return null
    return await data.text()
  }
  async exists(path: string): Promise<boolean> {
    const sb = getSb()
    const parent = path.split('/').slice(0, -1).join('/')
    const name = path.split('/').slice(-1)[0]
    const { data, error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET).list(parent || undefined, { search: name })
    if (error) return false
    return (data || []).some(f => f.name === name)
  }
  async list(prefix: string): Promise<string[]> {
    const sb = getSb()
    const allFiles: string[] = []

    async function listDirectory(currentPrefix: string) {
      const { data, error } = await sb.storage
        .from(MEMORY_SNAPSHOTS_BUCKET)
        .list(currentPrefix || undefined)

      if (error) {
        console.error(`Error listing files for prefix ${currentPrefix}:`, error)
        return
      }
      if (!data) return

      for (const file of data) {
        const newPath = `${currentPrefix ? currentPrefix.replace(/\/?$/, '/') : ''}${file.name}`

        // In Supabase Storage, folders are returned as objects without an `id`.
        // We can use this to recursively list directories.
        if (file.id === null) {
          await listDirectory(newPath)
        } else {
          allFiles.push(newPath)
        }
      }
    }

    await listDirectory(prefix)
    return allFiles
  }
  async delete(path: string): Promise<void> {
    const sb = getSb()
    const { error } = await sb.storage.from(MEMORY_SNAPSHOTS_BUCKET).remove([path])
    if (error) throw error
  }
}

