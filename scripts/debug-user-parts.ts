#!/usr/bin/env tsx
/**
 * Debug script to investigate parts data for a specific user
 * Usage: tsx scripts/debug-user-parts.ts <email>
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const email = process.argv[2]
if (!email) {
  console.error('❌ Please provide an email address')
  console.error('Usage: tsx scripts/debug-user-parts.ts <email>')
  process.exit(1)
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log(`\n🔍 Investigating parts for user: ${email}\n`)

  // 1. Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    console.error('❌ Profile not found:', profileError?.message)
    return
  }

  console.log('✅ Profile found:')
  console.log({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    created_at: profile.created_at,
  })

  // 2. Check auth.users table
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers()
  const user = authUser.users.find(u => u.email === email)
  
  if (user) {
    console.log('\n✅ Auth user found:')
    console.log({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    })
  } else {
    console.log('\n⚠️  Auth user not found')
  }

  // 3. Query parts table directly (no RLS)
  const { data: partsRaw, error: partsRawError } = await supabase
    .from('parts_v2')
    .select('*')
    .eq('user_id', profile.id)

  console.log('\n📊 Parts query (service role, no RLS):')
  if (partsRawError) {
    console.error('❌ Error:', partsRawError.message)
  } else {
    console.log(`✅ Found ${partsRaw?.length || 0} parts`)
    if (partsRaw && partsRaw.length > 0) {
      console.log('\nParts:')
      partsRaw.forEach((part: any, i) => {
        console.log(`  ${i + 1}. ${part.name ?? part.placeholder ?? 'Unnamed'} (${part.category}) - Status: ${part.status}`)
      })
    }
  }

  // 4. Check if user_id matches auth.uid()
  console.log('\n🔐 User ID verification:')
  console.log(`  Profile user_id: ${profile.id}`)
  console.log(`  Auth user id:    ${user?.id || 'N/A'}`)
  console.log(`  Match: ${profile.id === user?.id ? '✅' : '❌'}`)

  // 5. Query with buildPartsQuery pattern (what the app uses)
  const { data: partsQuery, error: partsQueryError } = await supabase
    .from('parts_v2')
    .select('*')
    .order('last_active', { ascending: false })
    .eq('user_id', profile.id)
    .limit(50)

  console.log('\n📊 Parts query (using app pattern):')
  if (partsQueryError) {
    console.error('❌ Error:', partsQueryError.message)
  } else {
    console.log(`✅ Found ${partsQuery?.length || 0} parts`)
  }

  // 6. Check memory_v2_snapshots for parts data
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('memory_v2_snapshots')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('\n🧠 Memory V2 snapshots:')
  if (snapshotsError) {
    console.error('❌ Error:', snapshotsError.message)
  } else {
    console.log(`✅ Found ${snapshots?.length || 0} recent snapshots`)
    if (snapshots && snapshots.length > 0) {
      console.log('\nRecent snapshots:')
      snapshots.forEach((snap, i) => {
        const content = snap.content as any
        console.log(`  ${i + 1}. ${snap.created_at} - ${content?.parts?.length || 0} parts`)
      })
    }
  }
}

main().catch(console.error)
