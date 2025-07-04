-- Create demo user in profiles table
-- Run this in your Supabase SQL Editor

INSERT INTO profiles (id, email, full_name, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'demo@discfinder.app',
    'Demo User',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;
