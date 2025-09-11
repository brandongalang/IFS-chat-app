import { NextResponse } from 'next/server';
import { getMastra } from '@/mastra';
import { createClient } from '@/lib/supabase/server';
import { resolveUserId } from '@/config/dev';
import type { Json } from '@/lib/types/database';

async function saveInsightsToDb(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  insights: Array<{ type: string; title: string; body: string; sourceSessionIds?: string[] }>
): Promise<boolean> {
  if (!insights || insights.length === 0) {
    return true; // Nothing to save
  }

  const now = new Date().toISOString();
  const payloads = insights.map(insight => ({
    user_id: userId,
    type: insight.type,
    status: 'pending',
    content: {
      title: insight.title,
      body: insight.body,
      highlights: [],
      sourceSessionIds: insight.sourceSessionIds || [],
    } as Json,
    meta: {
      generator: 'insight-generator-agent-v1',
      trigger: 'on-demand-request',
    } as Json,
    created_at: now,
    updated_at: now,
  }));

  const { error } = await supabase.from('insights').insert(payloads);

  if (error) {
    console.error('Failed to save insights to DB:', error);
    return false;
  }

  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = resolveUserId(body.userId);
    const supabase = await createClient();

    console.log(`Insight generation request received for user: ${userId}`);

    const mastra = getMastra();
    const insightWorkflow = mastra.getWorkflow('generateInsightWorkflow');

    const workflowRun = await insightWorkflow.execute({
      input: { userId },
    });

  let generatedInsights: Array<{ type: string; title: string; body: string; sourceSessionIds?: string[] }> = [];
    if (workflowRun.status === 'success') {
      generatedInsights = workflowRun.output || [];
    }

    console.log(`Agent generated ${generatedInsights.length} insights.`);

    if (generatedInsights.length > 0) {
      const saved = await saveInsightsToDb(supabase, userId, generatedInsights);
      if (!saved) {
        return NextResponse.json({ error: 'Failed to save generated insights.' }, { status: 500 });
      }
    }

    return NextResponse.json({
      message: 'Insight generation process completed.',
      insightsGenerated: generatedInsights.length,
    });

  } catch (error) {
    console.error('Error in insight request route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
