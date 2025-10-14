#!/usr/bin/env node
/**
 * Debug script to check Memory V2 storage for a user
 * Usage: node scripts/debug-memory-storage.ts <email>
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const email = process.argv[2]
if (!email) {
  console.error('❌ Please provide an email address')
  console.error('Usage: node scripts/debug-memory-storage.ts <email>')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log(`\n🔍 Checking Memory V2 storage for: ${email}\n`)

  // 1. Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .single()

  if (profileError || !profile) {
    console.error('❌ Profile not found:', profileError?.message)
    return
  }

  console.log('✅ Profile found:', profile.id)

  // 2. List files in user's memory folder
  const userPath = profile.id
  const { data: files, error: filesError } = await supabase.storage
    .from('memory-snapshots')
    .list(userPath, {
      limit: 100,
      offset: 0,
    })

  if (filesError) {
    console.error('❌ Error listing files:', filesError.message)
    return
  }

  console.log(`\n📁 Found ${files?.length || 0} items in memory-snapshots/${userPath}/`)
  
  if (files && files.length > 0) {
    console.log('\nFiles:')
    for (const file of files) {
      console.log(`  - ${file.name} (${file.id ? 'file' : 'folder'})`)
      
      // If it's a folder (like "parts" or "relationships"), list its contents
      if (!file.id && file.name) {
        const { data: subFiles } = await supabase.storage
          .from('memory-snapshots')
          .list(`${userPath}/${file.name}`, { limit: 50 })
        
        if (subFiles && subFiles.length > 0) {
          console.log(`    Contents (${subFiles.length} items):`)
          subFiles.forEach(sf => {
            console.log(`      - ${sf.name}`)
          })
        }
      }
    }
  }

  // 3. Try to read overview.md
  const overviewPath = `${userPath}/overview.md`
  console.log(`\n📄 Reading ${overviewPath}...`)
  
  const { data: overviewData, error: overviewError } = await supabase.storage
    .from('memory-snapshots')
    .download(overviewPath)

  if (overviewError) {
    console.error('❌ Error reading overview:', overviewError.message)
  } else if (overviewData) {
    const text = await overviewData.text()
    console.log('\n--- OVERVIEW.MD CONTENT ---')
    console.log(text)
    console.log('--- END OVERVIEW.MD ---')
    
    // Extract confirmed_parts section
    const confirmedPartsMatch = text.match(/## Confirmed Parts\s*\[\/\/\]: # \(anchor: confirmed_parts v1\)\s*([\s\S]*?)(?=\n## |\n---|\z)/i)
    if (confirmedPartsMatch) {
      console.log('\n🎯 Confirmed Parts Section:')
      console.log(confirmedPartsMatch[1].trim() || '(empty)')
    }
  }

  // 4. Check Supabase parts table
  const { data: partsData, count: partsCount } = await supabase
    .from('parts')
    .select('id, name, category, status', { count: 'exact' })
    .eq('user_id', profile.id)

  console.log(`\n📊 Supabase parts table: ${partsCount || 0} parts`)
  if (partsData && partsData.length > 0) {
    console.log('Parts in database:')
    partsData.forEach((part, i) => {
      console.log(`  ${i + 1}. ${part.name} (${part.category}) - ${part.status}`)
    })
  }
}

main().catch(console.error)
