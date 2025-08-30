import { NextResponse } from 'next/server';
import { insightGeneratorAgent } from '@/mastra/agents/insight-generator';
import { createClient } from '@/lib/supabase/server';
import { resolveUserId } from '@/config/dev';
import type { Database, Json } from '@/lib/types/database';

async function saveInsightsToDb(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  insights: any[]
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
    const supabase = createClient();

    console.log(`Insight generation request received for user: ${userId}`);

    // This is a simplified invocation for demonstration.
    // In a real scenario, you might have a more complex setup for managing agent runs.
    const agentRun = await insightGeneratorAgent.run({
      input: `Generate insights for user ${userId}`,
      context: { userId }, // Pass userId to be used by tools
    });

    let generatedInsights: any[] = [];
    if (agentRun.status === 'success' && agentRun.output) {
      // The agent calls the 'submitInsights' function. The output is the argument to that function.
      generatedInsights = agentRun.output.insights || [];
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
