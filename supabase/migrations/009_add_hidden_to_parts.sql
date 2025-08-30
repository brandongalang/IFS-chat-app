-- Migration to add an is_hidden flag to the parts table for subscription gating.

ALTER TABLE public.parts
  ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE NOT NULL;

-- Add an index on is_hidden for faster querying of visible parts.
CREATE INDEX idx_parts_is_hidden ON public.parts(is_hidden);

-- Add a comment for the new column for documentation purposes.
COMMENT ON COLUMN public.parts.is_hidden IS 'If true, this part is hidden from free-tier users who have exceeded their limit.';
