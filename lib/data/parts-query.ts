import type { SupabaseClient } from '@supabase/supabase-js'
import type { PartRow } from '@/lib/types/database'

// TODO(ifs-chat-app-5): This helper still targets `parts`. Once PRD search endpoints are wired,
// retire this file or translate queries onto the PRD views (parts_v2 / parts_display).

export interface PartQueryFilters {
  /**
   * Partial match against part name. The same term is also applied to the role field
   * to preserve existing fuzzy search behaviour.
   */
  name?: string
  status?: PartRow['status']
  category?: PartRow['category']
  limit?: number
  /**
   * Columns to select from the parts table. Defaults to `*`.
   */
  columns?: string
}

type PartsQueryClient = Pick<SupabaseClient<any>, 'from'>

function escapeOrSearchTerm(term: string) {
  return term.replace(/,/g, '\\,')
}

export function buildPartsQuery(
  supabase: PartsQueryClient,
  { name, status, category, limit, columns = '*' }: PartQueryFilters = {}
): any {
  let query = supabase.from('parts').select(columns).order('last_active', { ascending: false })

  if (typeof limit === 'number') {
    query = query.limit(limit)
  }

  if (name) {
    const searchTerm = escapeOrSearchTerm(name)
    query = query.or(`name.ilike.%${searchTerm}%,role.ilike.%${searchTerm}%`)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (category) {
    query = query.eq('category', category)
  }

  return query
}
