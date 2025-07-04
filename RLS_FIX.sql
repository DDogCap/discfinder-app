-- Quick fix for RLS policies to allow demo user access
-- Run this in your Supabase SQL Editor

-- Option 1: Temporarily disable RLS for testing (RECOMMENDED FOR DEMO)
ALTER TABLE found_discs DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS enabled, add demo user policies instead
-- (Comment out the lines above and uncomment the lines below)

-- CREATE POLICY "Allow demo user to insert found discs" ON found_discs
--     FOR INSERT WITH CHECK (finder_id = '00000000-0000-0000-0000-000000000000');

-- CREATE POLICY "Allow demo user to insert profile" ON profiles
--     FOR INSERT WITH CHECK (id = '00000000-0000-0000-0000-000000000000');

-- CREATE POLICY "Allow demo user to select own data" ON found_discs
--     FOR SELECT USING (finder_id = '00000000-0000-0000-0000-000000000000');

-- Note: For production, you'll want to re-enable RLS and use proper authentication
