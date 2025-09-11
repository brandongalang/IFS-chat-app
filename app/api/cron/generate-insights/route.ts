import { NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { mastra } from '@/mastra';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types/database';

const COOL_DOWN_HOURS = 48;
const CONCURRENCY_LIMIT = 5;

async function saveInsightsToDb(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  insights: Array<{ type: string; title: string; body: string; sourceSessionIds?: string[] }>
): Promise<boolean> {
  if (!insights || insights.length === 0) {
    return true;
  }
  const now = new Date().toISOString();
  const payloads = insights.map(insight => ({
    user_id: userId,
    type: insight.type,
    status: 'pending',
    content: { title: insight.title, body: insight.body, sourceSessionIds: insight.sourceSessionIds || [] } as Json,
    meta: { generator: 'insight-generator-agent-v1', trigger: 'daily-cron' } as Json,
    created_at: now,
    updated_at: now,
  }));
  const { error } = await supabase.from('insights').insert(payloads);
  if (error) {
    console.error(`[Cron] Failed to save insights for user ${userId}:`, error);
    return false;
  }
  return true;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('[Cron] Starting daily insight generation job.');
  const supabase = await createClient();
  const startTime = Date.now();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: userRows, error: usersError } = await supabase
    .from('users')
    .select('id, sessions!inner(id)')
    .gte('sessions.start_time', oneDayAgo);

  if (usersError) {
    console.error('[Cron] Error fetching users:', usersError);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  const userIds = Array.from(new Set((userRows || []).map(user => user.id)));
  const limit = pLimit(CONCURRENCY_LIMIT);

  async function processUser(userId: string) {
    try {
      const { data: lastInsight } = await supabase
        .from('insights')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastInsight) {
        const lastInsightDate = new Date(lastInsight.created_at);
        const coolDownDate = new Date(lastInsightDate.getTime() + COOL_DOWN_HOURS * 60 * 60 * 1000);
        if (new Date() < coolDownDate) {
          console.log(`[Cron] User ${userId} is in cool-down period. Skipping.`);
          return { userId, insightsGenerated: 0, skipped: true };
        }
      }

      console.log(`[Cron] Processing user ${userId}.`);
      const insightWorkflow = mastra.getWorkflow('generateInsightWorkflow');
      const workflowRun = await insightWorkflow.execute({
        input: { userId },
      });

      let generatedInsights: Array<{ type: string; title: string; body: string; sourceSessionIds?: string[] }> = [];
      if (workflowRun.status === 'success') {
        generatedInsights = workflowRun.output || [];
      }

      console.log(`[Cron] Agent generated ${generatedInsights.length} insights for user ${userId}.`);

      if (generatedInsights.length > 0) {
        await saveInsightsToDb(supabase, userId, generatedInsights);
      }

      return { userId, insightsGenerated: generatedInsights.length, skipped: false };
    } catch (error) {
      console.error(`[Cron] Error processing user ${userId}:`, error);
      return { userId, insightsGenerated: 0, skipped: true };
    }
  }

  const results = await Promise.all(userIds.map(userId => limit(() => processUser(userId))));

  let totalInsightsGenerated = 0;
  const processedUsers: string[] = [];
  let skippedUserCount = 0;

  for (const result of results) {
    if (result.skipped) {
      skippedUserCount += 1;
    } else {
      processedUsers.push(result.userId);
      totalInsightsGenerated += result.insightsGenerated;
    }
  }

  const durationMs = Date.now() - startTime;
  const summary = {
    message: 'Daily insight generation job completed.',
    processedUserCount: processedUsers.length,
    skippedUserCount,
    totalInsightsGenerated,
    durationMs,
  };

  console.log('[Cron] Job finished.', summary);
  return NextResponse.json(summary);
}
