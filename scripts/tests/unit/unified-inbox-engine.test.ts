import assert from 'node:assert/strict'
import { runUnifiedInboxEngine } from '@/lib/inbox/unified-inbox-engine'
import type { UnifiedInboxAgent } from '@/mastra/agents/unified-inbox'

// --- Mocks ---

function createSupabaseStub(data: {
  queueCount?: number;
  historyRows?: any[];
  insertResult?: any[];
  insertError?: any;
}) {
  const { queueCount = 0, historyRows = [], insertResult = [], insertError = null } = data

  const telemetry: any[] = []

  return {
    from(table: string) {
      if (table === 'inbox_items_view') {
        return {
          select(columns: any, options: any) { return this },
          eq() { return this },
          in() {
            return Promise.resolve({ count: queueCount, error: null })
          },
        }
      }

      if (table === 'inbox_items') {
        return {
          select() { return this },
          eq() { return this },
          gte() { return this },
          order() { return this },
          limit() {
            return Promise.resolve({ data: historyRows, error: null })
          },
          insert(rows: any[]) {
             if (insertError) {
                return {
                    select() { return Promise.resolve({ data: null, error: insertError }) }
                }
             }
             // Assign fake IDs
             const result = rows.map((r, i) => ({
                 id: `new-id-${i}`,
                 created_at: new Date().toISOString(),
                 status: 'pending',
                 semantic_hash: r.semantic_hash,
                 content: r.content
             }))
             return {
                 select() {
                     return Promise.resolve({ data: result, error: null })
                 }
             }
          }
        }
      }

      if (table === 'inbox_observation_telemetry') {
        return {
          insert(row: any) {
            telemetry.push(row)
            return Promise.resolve({ error: null })
          }
        }
      }

      throw new Error(`Unexpected table requested: ${table}`)
    },
    _telemetry: telemetry
  }
}

function createAgentStub(responses: any[]) {
  let callCount = 0
  return {
    generateVNext(prompt: string) {
      const response = responses[callCount] || responses[responses.length - 1]
      callCount++
      if (response instanceof Error) throw response
      return Promise.resolve(response)
    }
  } as unknown as UnifiedInboxAgent
}

// --- Tests ---

async function testQueueFull() {
  console.log('Test: Queue Full')
  const supabase = createSupabaseStub({ queueCount: 5 }) // Limit is default 5
  const agent = createAgentStub([])

  const result = await runUnifiedInboxEngine({
    supabase: supabase as any,
    agent,
    userId: 'user-1',
    queueLimit: 5
  })

  assert.equal(result.status, 'skipped')
  assert.equal(result.reason, 'queue_full')
  console.log('PASS')
}

async function testAgentFailure() {
  console.log('Test: Agent Failure')
  const supabase = createSupabaseStub({ queueCount: 0 })
  const agent = createAgentStub([new Error('API Error')])

  const result = await runUnifiedInboxEngine({
    supabase: supabase as any,
    agent,
    userId: 'user-1',
  })

  assert.equal(result.status, 'error')
  assert.equal(result.reason, 'agent_failure')
  console.log('PASS')
}

async function testSuccess() {
  console.log('Test: Success')
  const supabase = createSupabaseStub({ queueCount: 0 })
  const items = [
    {
      type: 'nudge',
      title: 'Test Nudge',
      summary: 'Summary is long enough now',
      body: 'Body',
      actions: { buttons: [] }
    }
  ]
  const agentResponse = {
    text: JSON.stringify({ items }),
    status: 'success'
  }
  const agent = createAgentStub([agentResponse])

  const result = await runUnifiedInboxEngine({
    supabase: supabase as any,
    agent,
    userId: 'user-1',
  })

  if (result.status !== 'success') {
      console.error('Test Success Failed with result:', JSON.stringify(result, null, 2))
  }

  assert.equal(result.status, 'success')
  assert.equal(result.inserted.length, 1)
  assert.equal(result.inserted[0].title, 'Test Nudge')
  console.log('PASS')
}

async function testJsonParsingResilience() {
  console.log('Test: JSON Parsing Resilience')
  const supabase = createSupabaseStub({ queueCount: 0 })

  // Case 1: Wrapped in markdown code block
  const jsonString = JSON.stringify({ items: [{ type: 'question', title: 'Question 1', summary: 'Summary is long enough now for valid schema', inference: 'I1', actions: { buttons: [] } }] })
  const agentResponse1 = { text: `Here is the JSON:\n\`\`\`json\n${jsonString}\n\`\`\``, status: 'success' }

  const agent = createAgentStub([agentResponse1])

  const result = await runUnifiedInboxEngine({
    supabase: supabase as any,
    agent,
    userId: 'user-1',
  })

  if (result.status !== 'success') {
      console.error('Test Json Resilience Failed:', JSON.stringify(result, null, 2))
  }

  assert.equal(result.status, 'success')
  assert.equal(result.inserted.length, 1)
  assert.equal(result.inserted[0].title, 'Question 1')
  console.log('PASS')
}

async function testDeduplication() {
  console.log('Test: Deduplication')

  const supabase = createSupabaseStub({ queueCount: 0 })
  const item = { type: 'nudge', title: 'Same', summary: 'Same text long enough', body: 'Same', actions: { buttons: [] } }
  const agentResponse = {
    text: JSON.stringify({ items: [item, item] }),
    status: 'success'
  }
  const agent = createAgentStub([agentResponse])

  const result = await runUnifiedInboxEngine({
      supabase: supabase as any,
      agent,
      userId: 'user-1',
      queueLimit: 5
  })

  assert.equal(result.status, 'success')
  assert.equal(result.inserted.length, 1) // Should be 1, not 2
  console.log('PASS')
}

async function main() {
  try {
    await testQueueFull()
    await testAgentFailure()
    await testSuccess()
    await testJsonParsingResilience()
    await testDeduplication()
    console.log('All unified-inbox-engine tests passed')
  } catch (e) {
    console.error('Test failed:', e)
    process.exit(1)
  }
}

void main()
