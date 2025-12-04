process.env.SERVER_ONLY_DISABLE_GUARD = 'true'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  const { searchPartsV2 } = await import('../../../lib/data/parts-lite')
  const { normalizePartRowDates, partRowSchema } = await import('../../../lib/data/schema/types')

  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: userId } }, error: null }
      },
    },
    from(table: string) {
      assert(table === 'parts_display', 'query target should be parts_display')
      const query = {
        select(this: typeof query) {
          return this
        },
        eq(this: typeof query) {
          return this
        },
        order(this: typeof query) {
          return this
        },
        limit(this: typeof query) {
          return this
        },
        async then(resolve: any) {
          // Mock PartsDisplayRow
          const row = {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            user_id: userId,
            display_name: 'Timestamp Test',
            name: 'Timestamp Test',
            placeholder: null,
            category: 'manager',
            status: 'active',
            charge: 'neutral',
            emoji: null,
            age: null,
            role: null,
            confidence: 0.5,
            evidence_count: 0,
            needs_attention: false,
            // These are the fields used for mapping
            last_active: '2025-10-18 12:34:56.789 +0000',
            created_at: '2025-10-18T12:34:56.789',
          }

          resolve({ data: [row], error: null })
        },
      }

      return query
    },
  }

  const results = await searchPartsV2({ limit: 1 }, { client: client as any, userId })
  assert(results.length === 1, 'should return parsed row')
  const part = results[0]
  
  // Verify normalization logic
  assert(part.created_at.endsWith('Z'), 'created_at normalized to ISO string')
  assert(part.last_active?.endsWith('Z'), 'last_active normalized to ISO string')
  
  // In the new implementation:
  // first_noticed maps to created_at
  // updated_at maps to last_active (if present)
  assert(part.first_noticed === part.created_at, 'first_noticed should map to created_at')
  assert(part.updated_at === part.last_active, 'updated_at should map to last_active')

  const parsed = partRowSchema.parse(normalizePartRowDates(part))
  assert(parsed.first_noticed === part.first_noticed, 'schema parse retains normalized value')

  console.log('parts-lite datetime normalization test passed')
}

main().catch((err) => {
  console.error('parts-lite datetime normalization test failed:', err)
  process.exit(1)
})
