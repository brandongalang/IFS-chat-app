import { createAdminClient } from '@/lib/supabase/admin';
import type { PostgrestError } from '@supabase/supabase-js';

const DEFAULT_IDLE_MINUTES = Number(process.env.MEMORY_SESSION_IDLE_MINUTES || 30);

interface TodayData {
  sessions: Record<string, unknown>[];
  insights: Record<string, unknown>[];
  checkIns: Record<string, unknown>[];
}

export async function listActiveUsersSince(isoCutoff: string): Promise<string[]> {
  const supabase = createAdminClient();

  // Sessions
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('created_at', isoCutoff);

  if (sErr) throw sErr;

  // Insights (created or updated) - now from inbox_items unified table
  const { data: insights, error: iErr } = await supabase
    .from('inbox_items')
    .select('user_id, created_at, updated_at')
    .or(`created_at.gte.${isoCutoff},updated_at.gte.${isoCutoff}`);

  if (iErr) throw iErr;

  const { data: checkIns, error: cErr } = await supabase
    .from('check_ins')
    .select('user_id')
    .gte('created_at', isoCutoff);

  if (cErr) throw cErr;

  const ids = new Set<string>();
  for (const r of sessions || []) ids.add(r.user_id);
  for (const r of insights || []) ids.add(r.user_id);
  for (const r of checkIns || []) ids.add(r.user_id);
  return [...ids];
}

export async function loadTodayData(userId: string, isoCutoff: string): Promise<TodayData> {
  const supabase = createAdminClient();

  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', isoCutoff)
    .eq('processed', false)
    .order('created_at', { ascending: true });

  if (sErr) throw sErr;

  const { data: insights, error: iErr } = await supabase
    .from('inbox_items')
    .select('*')
    .eq('user_id', userId)
    .or(`created_at.gte.${isoCutoff},updated_at.gte.${isoCutoff}`)
    .eq('processed', false)
    .order('created_at', { ascending: true });

  if (iErr) throw iErr;

  const { data: checkIns, error: cErr } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', isoCutoff)
    .eq('processed', false)
    .order('created_at', { ascending: true });

  if (cErr) throw cErr;

  return { sessions: sessions || [], insights: insights || [], checkIns: checkIns || [] };
}

type UnprocessedTable = 'sessions' | 'insights' | 'check_ins';

function logUnprocessedQueryError(table: UnprocessedTable, userId: string, error: PostgrestError) {
  try {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        tag: 'memory_updates',
        event: 'list_unprocessed_error',
        table,
        user_id: userId,
        code: error.code,
        hint: error.hint,
        details: error.details,
        message: error.message,
      })
    );
  } catch {
    console.error('[memory_updates] list_unprocessed_error', { table, userId, error });
  }
}

function formatUnprocessedError(table: UnprocessedTable, error: PostgrestError): Error {
  const code = error.code ? ` (${error.code})` : '';
  const message = error.message?.trim();
  const details = error.details?.trim();
  const parts = [
    `Supabase error while fetching ${table}${code}.`,
    message ? message : null,
    details ? `Details: ${details}` : null,
  ].filter(Boolean);
  const friendly = parts.join(' ');
  const err = new Error(friendly || `Supabase error while fetching ${table}.`);
  err.name = 'ListUnprocessedUpdatesError';
  return err;
}

async function fetchUnprocessedTable(
  supabase: ReturnType<typeof createAdminClient>,
  table: UnprocessedTable,
  userId: string
) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .eq('processed', false)
    .order('created_at', { ascending: true });

  if (error) {
    logUnprocessedQueryError(table, userId, error);
    throw formatUnprocessedError(table, error);
  }

  return data || [];
}

export async function listUnprocessedUpdates(userId: string): Promise<TodayData> {
  const supabase = createAdminClient();

  try {
    const [sessions, insights, checkIns] = await Promise.all([
      fetchUnprocessedTable(supabase, 'sessions', userId),
      fetchUnprocessedTable(supabase, 'insights', userId),
      fetchUnprocessedTable(supabase, 'check_ins', userId),
    ]);

    return {
      sessions,
      insights,
      checkIns,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    const err = new Error('Unexpected error while listing unprocessed updates.');
    err.name = 'ListUnprocessedUpdatesError';
    throw err;
  }
}

function extractIds(rows: Record<string, unknown>[] | undefined): string[] {
  if (!rows || rows.length === 0) return [];
  return rows
    .map((row) => {
      const id = row['id'];
      return typeof id === 'string' && id.length > 0 ? id : null;
    })
    .filter((id): id is string => Boolean(id));
}

export async function markUpdatesProcessed(userId: string, items: TodayData): Promise<void> {
  const supabase = createAdminClient();
  const processedAt = new Date().toISOString();

  const updateTable = async (table: 'sessions' | 'insights' | 'check_ins', ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from(table)
      .update({ processed: true, processed_at: processedAt })
      .in('id', ids)
      .eq('user_id', userId);

    if (error) throw error;
  };

  const sessionIds = extractIds(items.sessions);
  const insightIds = extractIds(items.insights);
  const checkInIds = extractIds(items.checkIns);

  await Promise.all([
    updateTable('sessions', sessionIds),
    updateTable('insights', insightIds),
    updateTable('check_ins', checkInIds),
  ]);
}

export async function finalizeStaleSessions(options: { idleMinutes?: number } = {}): Promise<{
  closed: number;
  enqueued: number;
  sessionIds: string[];
}> {
  const idleMinutes = options.idleMinutes ?? DEFAULT_IDLE_MINUTES;
  const supabase = createAdminClient();
  const cutoffIso = new Date(Date.now() - idleMinutes * 60 * 1000).toISOString();

  const { data: staleSessions, error } = await supabase
    .from('sessions')
    .select('id, user_id, start_time, updated_at')
    .is('end_time', null)
    .lte('updated_at', cutoffIso);

  if (error) {
    throw error;
  }

  if (!staleSessions || staleSessions.length === 0) {
    return { closed: 0, enqueued: 0, sessionIds: [] };
  }

  let closed = 0;
  const enqueued = 0;
  const sessionIds: string[] = [];

  for (const row of staleSessions) {
    const sessionId = typeof row.id === 'string' ? row.id : null;
    const userId = typeof row.user_id === 'string' ? row.user_id : null;
    if (!sessionId || !userId) continue;

    const endTime = row.updated_at ?? new Date().toISOString();
    const startTime = row.start_time ?? endTime;
    const durationSeconds = Math.max(
      0,
      Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
    );

    const { data: updated, error: updateError } = await supabase
      .from('sessions')
      .update({
        end_time: endTime,
        duration: durationSeconds,
        updated_at: endTime,
      })
      .eq('id', sessionId)
      .is('end_time', null)
      .select('id');

    if (updateError) {
      console.warn('[memory] finalizeStaleSessions: failed to update session', {
        sessionId,
        userId,
        error: updateError.message,
      });
      continue;
    }

    if (!updated || updated.length === 0) {
      continue;
    }

    closed += 1;
    sessionIds.push(sessionId);
  }

  return { closed, enqueued, sessionIds };
}
