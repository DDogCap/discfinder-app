-- Add default source functionality to user profiles
-- This allows users to set a preferred default source for reporting found discs
-- Run this in your Supabase SQL Editor

-- Add default_source_id field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_source_id UUID REFERENCES sources(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_default_source_id ON profiles(default_source_id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.default_source_id IS 'Default source location for reporting found discs - auto-populates source dropdown';

-- Create a function to get user's default source
CREATE OR REPLACE FUNCTION get_user_default_source(user_id UUID)
RETURNS TABLE(
    source_id UUID,
    source_name TEXT,
    source_description TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as source_id,
        s.name as source_name,
        s.description as source_description
    FROM profiles p
    LEFT JOIN sources s ON p.default_source_id = s.id
    WHERE p.id = user_id
      AND s.is_active = true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_default_source(UUID) TO authenticated;

-- Create a function to update user's default source
CREATE OR REPLACE FUNCTION update_user_default_source(
    user_id UUID,
    new_source_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    source_exists BOOLEAN := false;
BEGIN
    -- Check if user exists and is the authenticated user
    IF user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Can only update your own default source';
    END IF;

    -- If source_id is provided, verify it exists and is active
    IF new_source_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM sources 
            WHERE id = new_source_id AND is_active = true
        ) INTO source_exists;
        
        IF NOT source_exists THEN
            RAISE EXCEPTION 'Invalid source: Source does not exist or is inactive';
        END IF;
    END IF;

    -- Update the user's default source
    UPDATE profiles 
    SET 
        default_source_id = new_source_id,
        updated_at = NOW()
    WHERE id = user_id;

    RETURN true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_default_source(UUID, UUID) TO authenticated;

-- Show current default source statistics
SELECT 
    'Added default source functionality to profiles' as status,
    COUNT(*) as total_profiles,
    COUNT(default_source_id) as profiles_with_default_source,
    COUNT(DISTINCT default_source_id) as unique_default_sources_used
FROM profiles;
