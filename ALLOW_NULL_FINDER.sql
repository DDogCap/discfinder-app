-- Temporarily allow null finder_id for demo purposes
-- Run this in your Supabase SQL Editor

-- Make finder_id nullable temporarily
ALTER TABLE found_discs ALTER COLUMN finder_id DROP NOT NULL;

-- Add a comment to remember this is temporary
COMMENT ON COLUMN found_discs.finder_id IS 'Temporarily nullable for demo - will be required when auth is added';
