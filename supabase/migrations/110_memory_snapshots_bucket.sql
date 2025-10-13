-- Migration: Create memory-snapshots storage bucket for Memory V2 system
-- Date: 2025-01-14
-- Purpose: Store part profiles, user overviews, relationships, and sessions as markdown/JSON files

-- Create storage bucket for Memory V2 system
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memory-snapshots',
  'memory-snapshots',
  false,  -- Private bucket - files are user-specific
  10485760,  -- 10 MB limit per file
  NULL  -- Allow all MIME types (markdown, JSON, etc.)
)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security on storage.objects
-- (Should already be enabled, but ensure it)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memory-snapshots bucket
-- Files are stored with paths like: users/{userId}/parts/{partId}/profile.md
-- The user ID is the first segment of the path after the bucket

-- Policy: Users can read their own memory files
CREATE POLICY "Users can read own memory files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'memory-snapshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can create their own memory files
CREATE POLICY "Users can create own memory files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'memory-snapshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own memory files
CREATE POLICY "Users can update own memory files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'memory-snapshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own memory files
CREATE POLICY "Users can delete own memory files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'memory-snapshots' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role bypass policy (for agent operations)
-- The service role key bypasses RLS by default, but we add this for clarity
CREATE POLICY "Service role has full access to memory snapshots"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'memory-snapshots');

-- Create index for faster path queries
-- Optimizes common memory system queries that filter/search by path prefix
CREATE INDEX IF NOT EXISTS idx_storage_objects_memory_snapshots 
ON storage.objects(bucket_id, name) 
WHERE bucket_id = 'memory-snapshots';
