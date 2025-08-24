import { streamText, UIMessage, convertToModelMessages } from 'ai'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, model }: { messages: UIMessage[]; model?: string } = await req.json()

  const result = streamText({
    model: model || 'openai/gpt-4o',
    messages: convertToModelMessages(messages),
    system: 'You are a helpful IFS companion that responds with empathy and clarity.'
  })

  return result.toUIMessageStreamResponse({
    sendSources: false,
    sendReasoning: true,
  })
}


