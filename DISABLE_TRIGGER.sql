-- Temporarily disable the problematic trigger
-- Run this in your Supabase SQL Editor to fix signup

-- Drop the trigger that's causing the signup failure
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function as well
DROP FUNCTION IF EXISTS link_imported_profile();

-- We'll handle profile creation manually in the app instead
