import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export type CompleteOnboardingStateResult =
  | { success: true; completedAt: string }
  | { success: false; error: PostgrestError };

export async function completeOnboardingState(
  supabase: SupabaseClient<Database>,
  userId: string,
  version: number
): Promise<CompleteOnboardingStateResult> {
  const completedAt = new Date().toISOString();

  const { error } = await supabase
    .from('user_onboarding')
    .update({
      status: 'completed',
      stage: 'complete',
      completed_at: completedAt,
    })
    .eq('user_id', userId)
    .eq('version', version)
    .select()
    .single();

  if (error) {
    return { success: false, error };
  }

  return { success: true, completedAt };
}
