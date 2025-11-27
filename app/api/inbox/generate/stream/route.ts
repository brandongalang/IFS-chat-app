import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getUserClient, getServiceClient } from '@/lib/supabase/clients'
import { getSupabaseServiceRoleKey } from '@/lib/supabase/config'
import { errorResponse, HTTP_STATUS } from '@/lib/api/response'
import { createUnifiedInboxAgent } from '@/mastra/agents/unified-inbox'
import { getInboxQueueSnapshot, getRecentObservationHistory } from '@/lib/data/inbox-queue'
import { randomUUID } from 'node:crypto'
import { dev, resolveUserId } from '@/config/dev'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const requestSchema = z.object({
  userId: z.string().uuid().optional(),
})

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
} as const

/**
 * Streaming endpoint for inbox generation that shows tool calls in real-time.
 * Used for debugging and observability of the agentic loop.
 */
export async function POST(request: NextRequest) {
  // 1) Resolve user - support dev mode for local testing
  const useDevMode = dev.enabled && !!process.env.SUPABASE_SERVICE_ROLE_KEY
  let userId: string

  if (useDevMode) {
    try {
      userId = resolveUserId()
    } catch {
      return errorResponse(
        'Dev user not configured. Set IFS_TEST_PERSONA or IFS_DEFAULT_USER_ID.',
        HTTP_STATUS.UNAUTHORIZED,
      )
    }
  } else {
    const userSupabase = await getUserClient()
    const {
      data: { user },
    } = await userSupabase.auth.getUser()

    if (!user) {
      return errorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED)
    }

    try {
      const body = await request.json().catch(() => ({}))
      const parsed = requestSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse('Invalid request body', HTTP_STATUS.BAD_REQUEST)
      }
      userId = parsed.data.userId ?? user.id
    } catch {
      return errorResponse('Failed to parse request body', HTTP_STATUS.BAD_REQUEST)
    }

    if (userId !== user.id) {
      const isServiceRole =
        user.app_metadata?.service_role === true ||
        user.app_metadata?.roles?.includes('service_role') ||
        user.role === 'service_role'

      if (!isServiceRole) {
        return errorResponse('Forbidden', HTTP_STATUS.FORBIDDEN)
      }
    }
  }

  const serviceKey = getSupabaseServiceRoleKey()
  if (!serviceKey) {
    return errorResponse('Service role key missing', HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

  const runId = randomUUID()
  const admin = getServiceClient()

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        push('status', { type: 'started', runId, userId })

        // Step 1: Check queue
        push('status', { type: 'checking_queue' })
        const queue = await getInboxQueueSnapshot(admin, userId, { limit: 5 })
        push('queue', {
          total: queue.total,
          available: queue.available,
          limit: queue.limit,
          hasCapacity: queue.hasCapacity,
        })

        if (!queue.hasCapacity) {
          push('status', { type: 'skipped', reason: 'queue_full' })
          push('done', { status: 'skipped', reason: 'queue_full' })
          controller.close()
          return
        }

        // Step 2: Fetch history
        push('status', { type: 'fetching_history' })
        const history = await getRecentObservationHistory(admin, userId, { lookbackDays: 14 })
        push('history', { count: history.length })

        const remaining = Math.min(queue.available, 5)

        // Step 3: Build prompt
        const now = new Date()
        const historySummary = history.length
          ? history
              .slice(0, 10)
              .map((entry) => {
                const title = typeof entry.content?.title === 'string' ? entry.content.title : ''
                return `• ${entry.createdAt} ${title || entry.id}`
              })
              .join('\n')
          : '• No recent items'

        const prompt = `Generate up to ${remaining} fresh inbox items for user ${userId}.

Context:
- Current timestamp: ${now.toISOString()}
- Queue availability: ${remaining} slots
- User ID: ${userId}

Recent items (dedupe window):
${historySummary}

Supported Types:
1. session_summary - Key themes/breakthroughs from a recent session
2. nudge - Gentle hypothesis about parts/dynamics (2-3 sentences)
3. follow_up - Integration prompt after meaningful moment
4. observation - Therapy-grounded inference with evidence references
5. question - Curious probe inviting exploration
6. pattern - Synthesized insight across multiple evidence types

Rules:
- Use provided tools to research sessions, parts, therapy data, check-ins
- ALWAYS generate at least 1 item. If data is limited, generate a welcoming question or nudge to engage the user.
- Output valid JSON matching the unified inbox schema`

        push('status', { type: 'starting_agent', prompt: prompt.substring(0, 200) + '...' })

        // Step 4: Create agent and try different streaming methods
        const agent = createUnifiedInboxAgent({ userId }, { runId })

        let fullText = ''
        let toolCallCount = 0
        let streamMethod = 'unknown'

        // Try streamVNext first (supports V2 models like Gemini/Grok)
        const agentAny = agent as any

        if (typeof agentAny.streamVNext === 'function') {
          push('status', { type: 'trying_streamVNext' })
          streamMethod = 'streamVNext'

          try {
            const streamResult = await agentAny.streamVNext(prompt)
            push('status', { type: 'streamVNext_started', keys: Object.keys(streamResult || {}) })

            // streamVNext returns an object with various async iterables
            // Try to process the response based on available properties
            if (streamResult?.fullStream && Symbol.asyncIterator in streamResult.fullStream) {
              for await (const chunk of streamResult.fullStream) {
                const chunkType = chunk?.type || chunk?.event || 'unknown'
                switch (chunkType) {
                  case 'tool-call':
                  case 'tool_call':
                    toolCallCount++
                    push('tool_call', {
                      index: toolCallCount,
                      toolName: chunk.payload?.toolName || chunk.toolName,
                      args: chunk.payload?.args || chunk.args,
                    })
                    break
                  case 'tool-result':
                  case 'tool_result':
                    push('tool_result', {
                      toolName: chunk.payload?.toolName || chunk.toolName,
                      result: typeof (chunk.payload?.result || chunk.result) === 'string'
                        ? (chunk.payload?.result || chunk.result).substring(0, 500)
                        : chunk.payload?.result || chunk.result,
                    })
                    break
                  case 'text-delta':
                  case 'text_delta':
                    const delta = chunk.payload?.text || chunk.textDelta || chunk.delta || ''
                    fullText += delta
                    if (delta) push('text_delta', { text: delta })
                    break
                  case 'finish':
                  case 'step-finish':
                    push('status', { type: 'step_finished', reason: chunk.payload?.stepResult?.reason || chunk.finishReason })
                    break
                  default:
                    push('chunk', { type: chunkType, keys: Object.keys(chunk || {}) })
                }
              }
            } else if (streamResult?.textStream && Symbol.asyncIterator in streamResult.textStream) {
              push('status', { type: 'using_textStream' })
              for await (const text of streamResult.textStream) {
                fullText += text
                push('text_delta', { text })
              }
            } else {
              // Try to read from body if it's a Response-like object
              if (streamResult?.body) {
                push('status', { type: 'reading_response_body' })
                const reader = streamResult.body.getReader()
                const decoder = new TextDecoder()
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break
                  const text = decoder.decode(value, { stream: true })
                  fullText += text
                  push('text_delta', { text: text.substring(0, 100) })
                }
              } else {
                // Get final text directly
                fullText = await streamResult?.text || ''
                push('status', { type: 'got_final_text', length: fullText.length })
              }
            }
          } catch (streamVNextError) {
            push('error', {
              type: 'streamVNext_error',
              message: streamVNextError instanceof Error ? streamVNextError.message : String(streamVNextError)
            })
            // Fall through to try other methods
            streamMethod = 'streamVNext_failed'
          }
        }

        // If streamVNext didn't work or isn't available, try generateVNext
        if (!fullText && typeof agentAny.generateVNext === 'function') {
          push('status', { type: 'trying_generateVNext' })
          streamMethod = 'generateVNext'

          const generateResult = await agentAny.generateVNext(prompt)
          push('status', {
            type: 'generateVNext_result',
            keys: Object.keys(generateResult || {}),
            hasText: !!generateResult?.text
          })

          fullText = generateResult?.text || ''

          // Check for tool calls in the result
          if (generateResult?.toolCalls?.length) {
            toolCallCount = generateResult.toolCalls.length
            for (const tc of generateResult.toolCalls) {
              push('tool_call', { toolName: tc.toolName, args: tc.args })
            }
          }
          if (generateResult?.toolResults?.length) {
            for (const tr of generateResult.toolResults) {
              push('tool_result', { toolName: tr.toolName, result: tr.result })
            }
          }
        }

        // Last resort: try stream() even though it might fail for V2 models
        if (!fullText && typeof agentAny.stream === 'function') {
          push('status', { type: 'trying_stream' })
          streamMethod = 'stream'

          try {
            const agentStream = await agentAny.stream(prompt)

            if (agentStream?.fullStream) {
              for await (const chunk of agentStream.fullStream) {
                switch (chunk.type) {
                  case 'tool-call':
                    toolCallCount++
                    push('tool_call', {
                      index: toolCallCount,
                      toolName: chunk.payload?.toolName,
                      args: chunk.payload?.args,
                    })
                    break
                  case 'tool-result':
                    push('tool_result', {
                      toolName: chunk.payload?.toolName,
                      result: typeof chunk.payload?.result === 'string'
                        ? chunk.payload.result.substring(0, 500)
                        : chunk.payload?.result,
                    })
                    break
                  case 'text-delta':
                    fullText += chunk.payload?.text || ''
                    push('text_delta', { text: chunk.payload?.text })
                    break
                  case 'finish':
                    push('status', { type: 'agent_finished', reason: chunk.payload?.stepResult?.reason })
                    break
                  default:
                    if (chunk.type) {
                      push('chunk', { type: chunk.type })
                    }
                }
              }
            } else if (agentStream?.textStream) {
              for await (const text of agentStream.textStream) {
                fullText += text
                push('text_delta', { text })
              }
            } else {
              fullText = await agentStream?.text || ''
            }
          } catch (streamError) {
            push('error', {
              type: 'stream_error',
              message: streamError instanceof Error ? streamError.message : String(streamError)
            })
          }
        }

        push('status', { type: 'stream_complete', method: streamMethod })

        push('status', { type: 'parsing_response' })
        push('full_text', { text: fullText, length: fullText.length })

        // Try to parse JSON from the response
        let parsedItems: unknown[] = []
        try {
          const jsonMatch = fullText.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            parsedItems = JSON.parse(jsonMatch[0])
          }
        } catch (parseError) {
          push('error', { type: 'parse_error', message: String(parseError) })
        }

        push('parsed', { itemCount: parsedItems.length, items: parsedItems })
        push('done', {
          status: 'success',
          toolCallCount,
          itemCount: parsedItems.length,
          textLength: fullText.length,
        })
      } catch (error) {
        push('error', {
          type: 'stream_error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
        })
        push('done', { status: 'error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
