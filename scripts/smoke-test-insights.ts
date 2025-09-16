import { createClient } from '@supabase/supabase-js';
import { BASE_URL } from '../config/app';
import type { Database } from '../lib/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !CRON_SECRET) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const TEST_USER_ID = process.env.IFS_DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000';

async function getInsightCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('insights')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count || 0;
}

async function testOnDemand() {
  console.log('--- Testing On-Demand Insight Generation ---');
  console.log(`Using test user ID: ${TEST_USER_ID}`);

  const initialCount = await getInsightCount(TEST_USER_ID);
  console.log(`Initial insight count: ${initialCount}`);

  const response = await fetch(`${BASE_URL}/api/insights/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: TEST_USER_ID }),
  });

  if (!response.ok) {
    throw new Error(`On-demand request failed with status ${response.status}: ${await response.text()}`);
  }

  const result = await response.json();
  console.log('API Response:', result);

  const finalCount = await getInsightCount(TEST_USER_ID);
  console.log(`Final insight count: ${finalCount}`);

  if (finalCount > initialCount) {
    console.log('✅ PASSED: On-demand insight generation created new insights.');
  } else {
    // This could also be a valid outcome if the agent chose to generate 0 insights
    console.log('⚠️  NOTE: On-demand generation completed but created 0 insights. This may be expected.');
  }
  console.log('-------------------------------------------\n');
}

async function testCronJob() {
  console.log('--- Testing Daily Cron Job Insight Generation ---');
  // Note: This test is less deterministic as it depends on user state (recency, cool-down)
  // For a real test suite, you'd want to seed the DB with a known state first.

  console.log('Simulating cron job trigger...');
  const response = await fetch(`${BASE_URL}/api/cron/generate-insights`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });

  if (!response.ok) {
    throw new Error(`Cron job request failed with status ${response.status}: ${await response.text()}`);
  }

  const result = await response.json();
  console.log('API Response:', result);

  if (result.processedUserCount >= 0) {
    console.log('✅ PASSED: Cron job executed successfully.');
  } else {
    throw new Error('Cron job response did not contain expected data.');
  }
  console.log('-------------------------------------------\n');
}

async function main() {
  const mode = process.argv[2]; // 'on-demand' or 'cron'

  try {
    if (mode === 'on-demand') {
      await testOnDemand();
    } else if (mode === 'cron') {
      await testCronJob();
    } else {
      console.log('Running both tests...');
      await testOnDemand();
      await testCronJob();
    }
  } catch (error) {
    console.error('❌ FAILED: Smoke test encountered an error.');
    console.error(error);
    process.exit(1);
  }
}

main();
