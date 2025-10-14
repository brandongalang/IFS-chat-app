import fs from 'fs/promises'
import path from 'path'
import type { StorageAdapter } from './adapter'

// Local storage is deprecated - use SupabaseStorageAdapter instead
const DEFAULT_LOCAL_ROOT = '.data/memory-snapshots'
let hasWarnedDeprecatedAdapter = false

interface LocalFsAdapterOptions {
  root?: string | null
}

export class LocalFsStorageAdapter implements StorageAdapter {
  private readonly root: string
  private readonly rootAbs: string

  constructor(options?: LocalFsAdapterOptions) {
    if (!hasWarnedDeprecatedAdapter) {
      hasWarnedDeprecatedAdapter = true
      console.warn('[LocalFsStorageAdapter] This adapter is deprecated. Please migrate to SupabaseStorageAdapter.')
    }
    const configuredRoot = options?.root ?? process.env.MEMORY_LOCAL_ROOT ?? DEFAULT_LOCAL_ROOT
    this.root = configuredRoot
    this.rootAbs = path.resolve(process.cwd(), configuredRoot)
  }
  private resolveSafe(userPath: string) {
    const full = path.resolve(this.rootAbs, userPath.replace(/^\/+/, ''))
    if (!full.startsWith(this.rootAbs + path.sep) && full !== this.rootAbs) {
      throw new Error('Path traversal detected')
    }
    return { rootAbs: this.rootAbs, full }
  }
  async putText(userPath: string, text: string): Promise<void> {
    const { full } = this.resolveSafe(userPath)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, text, 'utf8')
  }
  async getText(userPath: string): Promise<string | null> {
    const { full } = this.resolveSafe(userPath)
    try { return await fs.readFile(full, 'utf8') } catch { return null }
  }
  async exists(userPath: string): Promise<boolean> {
    const { full } = this.resolveSafe(userPath)
    try { await fs.access(full); return true } catch { return false }
  }
  async list(prefix: string): Promise<string[]> {
    const { rootAbs, full } = this.resolveSafe(prefix)
    const out: string[] = []
    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) await walk(p)
        else out.push(path.relative(rootAbs, p))
      }
    }
    try { await walk(full) } catch {}
    return out
  }
  async delete(userPath: string): Promise<void> {
    const { full } = this.resolveSafe(userPath)
    try { await fs.unlink(full) } catch {}
  }
}

