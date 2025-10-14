#!/usr/bin/env tsx
/**
 * Setup Supabase Storage bucket for memory snapshots
 * 
 * Usage:
 *   TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod npx tsx scripts/setup-storage-bucket.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const BUCKET_NAME = 'memory-snapshots'

async function main() {
  const targetEnv = process.env.NEXT_PUBLIC_TARGET_ENV || process.env.TARGET_ENV || 'local'
  
  console.log('\n🪣 Supabase Storage Bucket Setup\n')
  console.log('='.repeat(60))
  console.log(`\n🌍 Environment: ${targetEnv.toUpperCase()}`)
  
  // Get credentials based on environment
  let url: string | undefined
  let serviceKey: string | undefined
  
  if (targetEnv === 'prod') {
    url = process.env.NEXT_PUBLIC_PROD_SUPABASE_URL
    serviceKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
    console.log(`   URL: ${url}`)
  } else {
    url = process.env.NEXT_PUBLIC_SUPABASE_URL
    serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log(`   URL: ${url}`)
  }
  
  if (!url || !serviceKey) {
    console.error('\n❌ Missing Supabase credentials!')
    console.error(`   Need: ${targetEnv === 'prod' ? 'NEXT_PUBLIC_PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_ROLE_KEY' : 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'}`)
    process.exit(1)
  }
  
  const supabase = createClient(url, serviceKey)
  
  // Check if bucket exists
  console.log(`\n📦 Checking for bucket: ${BUCKET_NAME}`)
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  
  if (listError) {
    console.error('❌ Error listing buckets:', listError.message)
    process.exit(1)
  }
  
  const bucketExists = buckets?.some(b => b.id === BUCKET_NAME)
  
  if (bucketExists) {
    console.log('✅ Bucket already exists!')
    
    // Test access
    console.log('\n🔍 Testing bucket access...')
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', { limit: 1 })
    
    if (error) {
      console.error('⚠️  Warning: Bucket exists but access test failed:', error.message)
    } else {
      console.log('✅ Bucket is accessible')
      console.log(`   Files at root: ${data?.length || 0}`)
    }
  } else {
    console.log('⚠️  Bucket does not exist. Creating...')
    
    const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    })
    
    if (error) {
      console.error('❌ Error creating bucket:', error.message)
      console.error('\nYou may need to create it manually via Supabase Dashboard:')
      console.error('1. Go to Storage section')
      console.error('2. Click "New bucket"')
      console.error(`3. Name: ${BUCKET_NAME}`)
      console.error('4. Public: false')
      console.error('5. File size limit: 50MB')
      process.exit(1)
    }
    
    console.log('✅ Bucket created successfully!')
  }
  
  // Check storage policies
  console.log('\n🔐 Storage policies:')
  console.log('   ℹ️  Policies must be checked via Supabase Dashboard → Storage → Policies')
  console.log('   Required policies:')
  console.log('   - Users can manage own memory snapshots (authenticated)')
  console.log('   - Service role full access (service_role)')
  
  console.log('\n' + '='.repeat(60))
  console.log('\n✅ Storage setup complete!')
  console.log('\n💡 Next steps:')
  console.log('   1. Test with: TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod npx tsx scripts/diagnose-garden.ts')
  console.log('   2. Create a test part: TARGET_ENV=prod NEXT_PUBLIC_TARGET_ENV=prod npx tsx scripts/test-frontmatter-system.ts')
  console.log('   3. Open PR and merge!\n')
}

main().catch((error) => {
  console.error('\n❌ Setup failed:', error)
  process.exit(1)
})
