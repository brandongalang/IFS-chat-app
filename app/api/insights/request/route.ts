import { getMastra } from '@/mastra';
import { getUserClient } from '@/lib/supabase/clients';
import { resolveUserId } from '@/config/dev';
import type { Json } from '@/lib/types/database';
import { errorResponse, jsonResponse, HTTP_STATUS } from '@/lib/api/response';

async function saveInsightsToDb(
  supabase: ReturnType<typeof getUserClient>,
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
    processed: false,
    processed_at: null,
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
    const supabase = getUserClient();

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
        return errorResponse('Failed to save generated insights.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }
    }

    return jsonResponse({
      message: 'Insight generation process completed.',
      insightsGenerated: generatedInsights.length,
    });

  } catch (error) {
    console.error('Error in insight request route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return errorResponse(errorMessage, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
