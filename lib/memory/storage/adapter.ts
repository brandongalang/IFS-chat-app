export interface StorageAdapter {
  putText(path: string, text: string, opts?: { contentType?: string }): Promise<void>
  getText(path: string): Promise<string | null>
  exists(path: string): Promise<boolean>
  list(prefix: string): Promise<string[]>
  delete(path: string): Promise<void>
}

export interface StorageAdapterFactoryOptions {
  mode?: 'local' | 'supabase'
}

