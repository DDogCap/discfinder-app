-- Add messaging fields to sources table for SMS functionality
-- This adds fields to store text message templates for found disc notifications

-- Add messaging fields to sources table
ALTER TABLE sources 
ADD COLUMN IF NOT EXISTS msg1_found_just_entered TEXT,
ADD COLUMN IF NOT EXISTS msg2_reminder TEXT;

-- Add comments for documentation
COMMENT ON COLUMN sources.msg1_found_just_entered IS 'Initial text message template sent when a disc is found and entered with this source';
COMMENT ON COLUMN sources.msg2_reminder IS 'Reminder text message template for follow-up communications';

-- Update the Source interface in TypeScript will need these fields:
-- msg1_found_just_entered?: string
-- msg2_reminder?: string

-- Grant necessary permissions
GRANT SELECT ON sources TO authenticated;
GRANT ALL ON sources TO service_role;

-- Note: After running this migration, you should:
-- 1. Update the sources import script to populate these fields from CSV
-- 2. Update the TypeScript Source interface in src/lib/supabase.ts
-- 3. Update the SourceManager component to allow editing these fields
