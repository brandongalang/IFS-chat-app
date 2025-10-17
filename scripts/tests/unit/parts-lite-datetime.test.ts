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
      assert(table === 'parts_v2', 'query target should be parts_v2')
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
          const row = {
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            user_id: userId,
            name: 'Timestamp Test',
            placeholder: null,
            category: 'manager',
            status: 'active',
            charge: 'neutral',
            data: {},
            needs_attention: false,
            confidence: 0.5,
            evidence_count: 0,
            first_noticed: '2025-10-18 12:34:56.789+00',
            last_active: '2025-10-18 12:34:56.789+00',
            created_at: '2025-10-18 12:34:56.789+00',
            updated_at: '2025-10-18 12:34:56.789+00',
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
  assert(part.first_noticed.endsWith('Z'), 'first_noticed normalized to ISO string')
  assert(part.last_active?.endsWith('Z'), 'last_active normalized to ISO string')
  assert(part.created_at.endsWith('Z'), 'created_at normalized to ISO string')
  assert(part.updated_at.endsWith('Z'), 'updated_at normalized to ISO string')
  const parsed = partRowSchema.parse(normalizePartRowDates(part))
  assert(parsed.first_noticed === part.first_noticed, 'schema parse retains normalized value')

  console.log('parts-lite datetime normalization test passed')
}

main().catch((err) => {
  console.error('parts-lite datetime normalization test failed:', err)
  process.exit(1)
})
