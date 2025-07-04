-- Debug Authentication Issues
-- Run this in your Supabase SQL Editor to diagnose the problem

-- 1. Check if the user_role enum exists
SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
) as user_role_enum_exists;

-- 2. Check if the role column exists in profiles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role';

-- 3. Check if the trigger function exists
SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'
) as handle_new_user_function_exists;

-- 4. Check if the trigger exists
SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
) as trigger_exists;

-- 5. Check current profiles table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 6. Check if there are any existing profiles
SELECT id, email, role, created_at FROM profiles LIMIT 5;

-- 7. Check RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- If you're getting errors, try these fixes:

-- Fix 1: Create the enum if it doesn't exist
-- CREATE TYPE user_role AS ENUM ('guest', 'user', 'admin');

-- Fix 2: Add the role column if it doesn't exist
-- ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'user';

-- Fix 3: Temporarily disable the trigger to test
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Fix 4: Check if profiles table allows inserts
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
