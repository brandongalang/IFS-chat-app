import type { StorageAdapter } from '@/lib/memory/storage/adapter'
import { getStorageAdapter } from '@/lib/memory/snapshots/fs-helpers'
import { lintMarkdown, patchSectionByAnchor } from './md'

export async function editMarkdownSection(path: string, anchor: string, change: { replace?: string; append?: string }) {
  const storage: StorageAdapter = await getStorageAdapter()
  const current = await storage.getText(path)
  if (!current) throw new Error(`File not found: ${path}`)
  const patched = patchSectionByAnchor(current, anchor, change)
  // Lint post-change (non-blocking)
  const lint = lintMarkdown(patched.text)
  await storage.putText(path, patched.text, { contentType: 'text/markdown; charset=utf-8' })
  return { ...patched, lint }
}

