-- Add avatar_url column to users table
-- Migration: 022_add_avatar_url_to_users

-- Add avatar_url column to store profile picture URLs
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN users.avatar_url IS 'URL to user profile picture stored in Supabase storage';