#!/usr/bin/env tsx
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })
loadEnv({ path: path.resolve(process.cwd(), '.env') })

const argMap = new Map<string, string>()
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]
  if (!key?.startsWith('--')) continue
  const value = process.argv[i + 1]
  if (!value || value.startsWith('--')) {
    console.error(`Missing value for argument ${key}`)
    process.exit(1)
  }
  argMap.set(key.slice(2), value)
}

const InsightContentSchema = z.object({
  title: z.string().min(4, 'title must be at least 4 characters'),
  body: z.string().min(10, 'body must be at least 10 characters'),
  summary: z.string().optional(),
  prompt: z.string().optional(),
  evidence: z.unknown().optional(),
  sources: z.array(z.object({ label: z.string(), url: z.string().url() })).optional(),
  cta: z
    .object({
      label: z.string(),
      href: z.string().url().optional(),
      helperText: z.string().optional(),
      target: z.enum(['_self', '_blank']).optional(),
    })
    .optional(),
})

const InsightMetaSchema = z
  .object({
    generator: z.string().optional(),
    priority: z.number().int().min(0).max(99).optional(),
    tags: z.array(z.string()).optional(),
    response_labels: z
      .object({
        agreeStrong: z.string().optional(),
        agree: z.string().optional(),
        disagree: z.string().optional(),
        disagreeStrong: z.string().optional(),
      })
      .optional(),
    action_helper_text: z.string().optional(),
  })
  .passthrough()

const userId = argMap.get('user')
const type = argMap.get('type') ?? 'observation'
const contentPath = argMap.get('content')
const metaPath = argMap.get('meta')

if (!userId) {
  console.error('Missing required --user <uuid> argument')
  process.exit(1)
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!uuidRegex.test(userId)) {
  console.error('Invalid --user format: expected UUID')
  process.exit(1)
}

const allowedTypes = ['session_summary', 'nudge', 'follow_up', 'observation', 'question'] as const
if (!allowedTypes.includes(type as typeof allowedTypes[number])) {
  console.error(`Invalid --type value. Expected one of: ${allowedTypes.join(', ')}`)
  process.exit(1)
}

if (!contentPath) {
  console.error('Missing required --content <path-to-json> argument')
  process.exit(1)
}

const resolveJsonInput = (inputPath: string) => {
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`)
    process.exit(1)
  }
  try {
    const raw = fs.readFileSync(absolutePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    console.error(`Failed to read or parse JSON from ${absolutePath}:`, error)
    process.exit(1)
  }
}

const content = InsightContentSchema.parse(resolveJsonInput(contentPath))
const meta = metaPath ? InsightMetaSchema.parse(resolveJsonInput(metaPath)) : {}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { error } = await supabase.from('insights').insert({
    user_id: userId,
    type,
    status: 'pending',
    content,
    meta: {
      ...meta,
      generator: meta.generator ?? 'admin_cli',
    },
  })

  if (error) {
    console.error('Failed to insert insight:', error)
    process.exit(1)
  }

  console.log('Created inbox insight for user:', userId)
  console.log('Type:', type)
  console.log('Title:', content.title)
}

void main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
