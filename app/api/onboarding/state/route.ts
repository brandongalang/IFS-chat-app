import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/onboarding/state
 * 
 * Returns the current user's onboarding state for middleware and UI.
 * Features:
 * - Lightweight endpoint for checking onboarding completion status
 * - Used by middleware to determine redirect behavior
 * - Returns minimal state information for privacy
 * - Creates initial state if none exists
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's onboarding state
    const stateResult = await supabase
      .from('user_onboarding')
      .select('id, user_id, stage, status, completed_at, version, started_at')
      .eq('user_id', user.id)
      .single();
    let userState = stateResult.data;
    const stateError = stateResult.error;

    // If no state exists, create initial state
    if (stateError && stateError.code === 'PGRST116') {
      const { data: newState, error: createError } = await supabase
        .from('user_onboarding')
        .insert({
          user_id: user.id,
          stage: 'stage1',
          status: 'in_progress'
        })
        .select('id, user_id, stage, status, completed_at, version, started_at')
        .single();

      if (createError) {
        console.error('Error creating initial onboarding state:', createError);
        return NextResponse.json({ error: 'Failed to initialize onboarding' }, { status: 500 });
      }

      userState = newState;
    } else if (stateError) {
      console.error('Error fetching onboarding state:', stateError);
      return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
    }

    // Return minimal state for privacy and performance
    const response = {
      id: userState!.id,
      stage: userState!.stage,
      status: userState!.status,
      completed_at: userState!.completed_at,
      started_at: userState!.started_at,
      version: userState!.version,
      needs_onboarding: userState!.status !== 'completed'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in state route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
