-- Add go_deeper type to inbox_items
-- Migration: 133_go_deeper_inbox_type

-- 1. Drop and recreate the type CHECK constraint to include go_deeper
ALTER TABLE public.inbox_items
DROP CONSTRAINT IF EXISTS inbox_items_type_check;

ALTER TABLE public.inbox_items
ADD CONSTRAINT inbox_items_type_check
CHECK (type IN (
  'session_summary',
  'nudge',
  'follow_up',      -- Keep for backward compatibility
  'observation',
  'question',       -- Keep for backward compatibility
  'pattern',
  'go_deeper'       -- NEW: conversation starters that link to chat
));

-- 2. Add index for go_deeper queries (filter by user and type)
CREATE INDEX IF NOT EXISTS idx_inbox_items_user_go_deeper
  ON public.inbox_items(user_id, created_at DESC)
  WHERE type = 'go_deeper' AND status IN ('pending', 'revealed');

-- 3. Comment documenting the type values
COMMENT ON COLUMN public.inbox_items.type IS 'Message types: session_summary, nudge, observation, pattern (statement-based for agree/disagree), go_deeper (conversation starters for chat). Legacy types follow_up and question kept for backward compatibility.';
