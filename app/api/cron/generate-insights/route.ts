import { NextResponse } from 'next/server';
import { getMastra } from '@/mastra';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types/database';

const COOL_DOWN_HOURS = 48;

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
    processed: false,
    processed_at: null,
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

  const { data: users, error: usersError } = await supabase.from('users').select('id');

  if (usersError) {
    console.error('[Cron] Error fetching users:', usersError);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  let totalInsightsGenerated = 0;
  const processedUsers = [];

  for (const user of users) {
    const userId = user.id;

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
        continue;
      }
    }

    const oneDayAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentActivity } = await supabase
      .from('sessions')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('start_time', oneDayAgo);

    if (!recentActivity || recentActivity.length === 0) {
      console.log(`[Cron] No recent activity for user ${userId}. Skipping.`);
      continue;
    }

    console.log(`[Cron] Processing user ${userId}.`);
    const mastra = getMastra();
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
      totalInsightsGenerated += generatedInsights.length;
    }
    processedUsers.push(userId);
  }

  const summary = {
    message: 'Daily insight generation job completed.',
    processedUserCount: processedUsers.length,
    totalInsightsGenerated,
  };

  console.log('[Cron] Job finished.', summary);
  return NextResponse.json(summary);
}
