#!/usr/bin/env tsx

import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { TEST_PERSONAS, type TestPersona, getPersonaUserId } from '../config/personas'
import { DEFAULT_MODEL_ID } from '../config/model'

const envPath = existsSync('.env.local') ? '.env.local' : '.env'
dotenv.config({ path: envPath })

type Args = {
  persona: 'all' | TestPersona
  count: number
  date?: string // YYYY-MM-DD (UTC)
  confirm: boolean
}

const PERSONA_SCENARIOS: Record<TestPersona, string[]> = {
  beginner: [
    'Naming the Inner Critic that appears before reviews; gentle exploration without changing it',
    'Avoidance/procrastination before ambiguous tasks; noticing what it protects',
    'Fear before speaking up; a younger exile part wants safety and acceptance'
  ],
  moderate: [
    'Evening numbing after tough feedback; Self-Soother comforting a vulnerable teen',
    'Planner vs. Overachiever tension around scheduling and sustainable pace',
    'Encourager part offering warm motivation after a small setback'
  ],
  advanced: [
    'Pre-demo tension: Critic protecting the Ashamed Teen; Caretaker mediates',
    'Boundary work: Protector Coach coordinating with Strategist to reduce overwork',
    'Complex relationship mapping and polarization tracking between multiple protectors'
  ]
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const persona = (get('--persona') as any) || 'all'
  const count = parseInt(get('--count') || '5', 10)
  const date = get('--date')
  const confirm = args.includes('--confirm') && (get('--confirm') || '').toLowerCase() === 'generate mock sessions'
  if (!confirm) throw new Error('Must include --confirm "generate mock sessions" flag for safety')
  if (!['all', 'beginner', 'moderate', 'advanced'].includes(persona)) throw new Error('Invalid --persona')
  return { persona: persona as any, count, date, confirm }
}

function assertSafety() {
  if (process.env.IFS_DEV_MODE !== 'true') {
    throw new Error('IFS_DEV_MODE must be true to run mock session generation')
  }
  const isStaging = process.env.TARGET_ENV === 'staging'
  const url = isStaging ? process.env.STAGING_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = isStaging ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase URL or Service Role Key in env')
  const openrouter = process.env.OPENROUTER_API_KEY
  if (!openrouter) throw new Error('OPENROUTER_API_KEY is required in env to generate content')
  return { url, serviceKey, openrouter }
}

function fmtDate(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toIso(d: Date) { return d.toISOString() }

function addMinutes(d: Date, mins: number) { return new Date(d.getTime() + mins * 60_000) }

async function callOpenRouter(openrouterKey: string, systemPrompt: string, userPrompt: string) {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'IFS Mock Session Seeder'
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL_ID,
      temperature: 0.8,
      max_tokens: 1400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`OpenRouter API error: ${resp.status} ${resp.statusText} ${text}`)
  }
  const json: any = await resp.json()
  const content: string = json?.choices?.[0]?.message?.content || ''
  if (!content) throw new Error('Empty content from model')
  return content
}

function parseConversation(raw: string): { messages: { role: 'user'|'assistant'; content: string; toolCalls?: Array<{ name: string; arguments: any; result?: any }> }[], summary?: string } {
  const trimmed = raw.trim()
  try {
    const obj = JSON.parse(trimmed)
    if (Array.isArray(obj?.messages)) {
      const msgs = obj.messages
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || ''),
          toolCalls: Array.isArray(m.toolCalls) ? m.toolCalls.map((t: any) => ({
            name: String(t.name || ''),
            arguments: t.arguments ?? {},
            result: t.result
          })).filter((t: any) => t.name) : undefined
        }))
        .filter((m: any) => m.content || (m.toolCalls && m.toolCalls.length))
      return { messages: msgs, summary: typeof obj.summary === 'string' ? obj.summary : undefined }
    }
  } catch (_) {}

  const lines = trimmed.split(/\r?\n/)
  const out: { role: 'user'|'assistant'; content: string }[] = []
  for (const line of lines) {
    const m = line.match(/^\s*(user|assistant)\s*[:：]\s*(.+)$/i)
    if (m) {
      const role = m[1].toLowerCase() === 'assistant' ? 'assistant' : 'user'
      const content = m[2].trim()
      if (content) out.push({ role, content })
    }
  }
  if (out.length < 2) {
    return { messages: [
      { role: 'user', content: 'I felt anxious before a presentation and then avoided preparing.' },
      { role: 'assistant', content: 'Thanks for noticing that. Can we get curious about the part that felt anxious, and what it might be trying to protect you from?' }
    ] }
  }
  return { messages: out }
}

async function generateOneSession(openrouterKey: string, persona: TestPersona, partSnippets: string[]) {
  const systemPrompt = `You are an IFS (Internal Family Systems) companion. Generate ONE realistic chat between a user and an assistant that reflects curious, non-judgmental exploration of parts.

Return strict JSON when possible with this shape:
{
  "messages": [
    {"role":"user"|"assistant", "content":"...", "toolCalls":[{"name":"...","arguments":{...},"result":{...}}]? },
    ...
  ],
  "summary": "(optional short session summary)"
}

Tool emulation (optional, keep 0–2 calls per session): you may add toolCalls on assistant messages using these tool names and intent:
- searchParts({ query }) → returns brief list of matching parts
- getPartById({ partId }) → returns part details
- createEmergingPart({ name, evidence: [ ... ], userConfirmed }) → returns new part id
- updatePart({ partId, fields }) → returns updated part
- getPartRelationships({ partId? }) → returns relationships summary
- rollbackAction({ actionId }) → returns rollback status

Rules:
- 10 to 16 total turns (messages array length), alternating starting with user.
- Do not give advice or diagnoses; be curious and reflective.
- Avoid emojis or markdown.
- Keep each message concise.
- Do NOT include timestamps in content; timestamps will be added by the seeder.
- If you include toolCalls, keep arguments realistic and concise. Prefer to show intent rather than large payloads.
`

  const scenarios = PERSONA_SCENARIOS[persona]
  const scenarioHint = scenarios[Math.floor(Math.random() * scenarios.length)]

  const personaContext = `Persona: ${persona}. Focus scenario: ${scenarioHint}. Parts that may appear in conversation:\n${partSnippets.join('\n')}`

  const userPrompt = `Create one IFS-style conversation centered on the focus scenario. If relevant, emulate at most two assistant toolCalls as described. ${personaContext}\nOutput strict JSON if possible.`

  const raw = await callOpenRouter(openrouterKey, systemPrompt, userPrompt)
  return parseConversation(raw)
}

async function main() {
  const { persona, count, date } = parseArgs()
  const { url, serviceKey, openrouter } = assertSafety()

  const supabase = createClient(url!, serviceKey!)

  const personas: TestPersona[] = persona === 'all' ? ['beginner','moderate','advanced'] : [persona]

  const baseDate = date ? new Date(date + 'T09:00:00Z') : new Date()
  const spreadDays = 21

  for (const p of personas) {
    const userId = getPersonaUserId(p)

    const { data: parts, error: partsErr } = await supabase
      .from('parts')
      .select('name, category, role, confidence')
      .eq('user_id', userId)
      .limit(6)

    if (partsErr) {
      console.warn(`[warn] fetching parts for ${p}: ${partsErr.message}`)
    }

    const partSnippets = (parts || []).map((pt: any) => {
      const role = pt.role ? ` – ${pt.role}` : ''
      const conf = typeof pt.confidence === 'number' ? ` (c=${pt.confidence.toFixed(2)})` : ''
      return `- ${pt.name} [${pt.category}]${role}${conf}`
    })

    for (let i = 1; i <= count; i++) {
      console.log(`→ Generating session ${i}/${count} for ${p} ...`)
      const convo = await generateOneSession(openrouter, p, partSnippets)

      const offsetDays = count > 1 ? Math.floor((spreadDays * (i - 1)) / (count - 1)) : 0
      const sessionDay = new Date(baseDate.getTime() - offsetDays * 24 * 3600 * 1000)

      const start = new Date(fmtDate(sessionDay) + 'T09:00:00Z')
      start.setUTCHours(9 + (p === 'beginner' ? 0 : p === 'moderate' ? 1 : 2))
      start.setUTCMinutes((i - 1) * 10)

      const messages = convo.messages.map((m, idx) => ({
        role: m.role,
        content: m.content,
        timestamp: toIso(addMinutes(start, idx * 2)),
        toolCalls: m.toolCalls
      }))

      const start_time = messages[0]?.timestamp || toIso(start)
      const end_time = messages[messages.length - 1]?.timestamp || toIso(addMinutes(start, 20))
      const duration = Math.max(2 * messages.length, 10)

      const { data: existing, error: exErr } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('start_time', start_time)
        .maybeSingle()

      if (!exErr && existing) {
        console.log(`↪︎ Skipping existing session at ${start_time}`)
        continue
      }

      const sessionRow = {
        user_id: userId,
        start_time,
        end_time,
        duration,
        messages,
        summary: convo.summary || null,
        parts_involved: {},
        new_parts: [],
        breakthroughs: [],
        emotional_arc: { start: { valence: 0, arousal: 0.4 }, peak: { valence: 0, arousal: 0.6 }, end: { valence: 0.2, arousal: 0.3 } },
        processed: true,
        processed_at: end_time,
        created_at: start_time,
        updated_at: end_time
      }

      const { error: insErr } = await supabase
        .from('sessions')
        .insert(sessionRow)

      if (insErr) {
        console.error(`❌ Insert failed for session starting ${start_time}:`, insErr.message)
        continue
      }

      console.log(`✅ Inserted session starting ${start_time}`)
    }
  }

  console.log('🎉 Mock session generation complete')
}

main().catch((e) => { console.error('❌ Generation failed:', e?.message || e); process.exit(1) })
