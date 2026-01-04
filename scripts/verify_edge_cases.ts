
import 'server-only'
import { resolveUserId } from '@/config/dev'
import { logRelationship } from '@/lib/data/schema/parts-agent'
import { ChatSessionService } from '@/lib/session-service'
import { getServiceClient } from '@/lib/supabase/clients'
import { createEmergingPart } from '@/lib/data/schema/parts-agent'
import { v4 as uuidv4 } from 'uuid'

async function checkResolveUserId() {
  console.log('\n--- Checking resolveUserId (Prod Simulation) ---')
  // We expect NODE_ENV=production and IFS_DEV_MODE=false to be set in the run command
  try {
    resolveUserId(undefined)
    console.log('FAIL: resolveUserId(undefined) did NOT throw in production mode.')
  } catch (error: any) {
    if (error.message.includes('User ID is required')) {
      console.log('SUCCESS: resolveUserId(undefined) threw as expected in production mode.')
    } else {
      console.log(`FAIL: resolveUserId threw unexpected error: ${error.message}`)
    }
  }
}

async function checkSelfRelationship() {
  console.log('\n--- Checking logRelationship Self-Reference ---')
  const client = getServiceClient()
  const userId = uuidv4()

  // Clean up helper
  const cleanup = async () => {
      try {
        await client.from('users').delete().eq('id', userId)
      } catch {}
  }

  // Upsert user first to satisfy FK
  // Note: We use service role client so RLS doesn't block us from deleting later?
  // Actually getServiceClient() is service role.
  await client.from('users').upsert({ id: userId, email: 'test-edge-case@example.com' })

  try {
      // Create a part
      let partId: string
      try {
            const part = await createEmergingPart({
                name: `Test Part ${Date.now()}`,
                evidence: [{
                    content: 'test evidence',
                    confidence: 0.8,
                    timestamp: new Date().toISOString(),
                    type: 'behavior',
                    sessionId: uuidv4()
                }, {
                    content: 'test evidence 2',
                    confidence: 0.8,
                    timestamp: new Date().toISOString(),
                    type: 'behavior',
                    sessionId: uuidv4()
                }, {
                    content: 'test evidence 3',
                    confidence: 0.8,
                    timestamp: new Date().toISOString(),
                    type: 'behavior',
                    sessionId: uuidv4()
                }],
                userConfirmed: true
            }, { client, userId })
            partId = part.id
      } catch (e: any) {
            console.log(`Setup failed: Could not create test part. ${e.message}`)
            return
      }

      try {
        await logRelationship({
            partIds: [partId, partId],
            type: 'polarized',
            description: 'Self protection'
        }, { client, userId })
        console.log('FAIL: logRelationship allowed creating a relationship with the same part ID twice.')
      } catch (error: any) {
        if (error.message.includes("check_part_ids_different") || error.message.includes("violates check constraint")) {
           console.log(`SUCCESS: logRelationship failed as expected with DB constraint: ${error.message}`)
        } else {
           console.log(`SUCCESS: logRelationship failed (likely DB constraint or validation): ${error.message}`)
        }
      }
  } finally {
      await cleanup()
  }
}

// Mock storage adapter to simulate race condition without relying on FS speed
// We will just wrap the real ChatSessionService and inspect behavior if possible,
// but since we can't easily mock internals here, we will rely on a stress test with FS.
async function checkRaceCondition() {
    console.log('\n--- Checking ChatSessionService Race Condition ---')
    const client = getServiceClient()
    const userId = uuidv4()

    const cleanup = async () => {
        try {
          await client.from('users').delete().eq('id', userId)
          // Sessions cascade delete usually? Or manually delete.
          // We rely on cascade or ignore leftover for now as 'users' delete is main cleanup.
        } catch {}
    }

    const service = new ChatSessionService({ supabase: client, userId })

    try {
        // Create user first
        await client.from('users').upsert({ id: userId, email: 'test-race@example.com' })

        let sessionId: string
        try {
            sessionId = await service.startSession()
        } catch (e: any) {
            console.log(`Setup failed: Could not start session. ${e.message}`)
            return
        }

        // Fire 5 concurrent addMessage calls
        const promises = []
        for (let i = 0; i < 5; i++) {
            promises.push(service.addMessage(sessionId, {
                role: 'user',
                content: `Message ${i}`
            }))
        }

        await Promise.allSettled(promises)

        const transcript = await service.getSessionMessages(sessionId)
        console.log(`Total messages stored: ${transcript.length}`)
        if (transcript.length === 5) {
            console.log('PASS: All 5 messages were stored (no race condition observed, or file system was fast enough).')
        } else {
            console.log(`FAIL: Race condition observed! Expected 5 messages, found ${transcript.length}.`)
        }
    } finally {
        await cleanup()
    }
}

async function run() {
    await checkResolveUserId()
    await checkSelfRelationship()
    await checkRaceCondition()
}

run().catch(console.error)
