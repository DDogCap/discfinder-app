-- Fix User Creation Issues
-- Run this step by step in your Supabase SQL Editor

-- Step 1: Create the user_role enum (run this first)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('guest', 'user', 'admin');
        RAISE NOTICE 'Created user_role enum';
    ELSE
        RAISE NOTICE 'user_role enum already exists';
    END IF;
END $$;

-- Step 2: Add role column to profiles table (run this second)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'user';
        RAISE NOTICE 'Added role column to profiles table';
    ELSE
        RAISE NOTICE 'role column already exists';
    END IF;
END $$;

-- Step 3: Drop existing trigger to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 4: Create the user creation function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'user'::user_role
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 6: Update RLS policies to be more permissive for user creation
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new, more permissive policies
CREATE POLICY "Enable read access for all users" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for system" ON profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Step 7: Verify the setup
SELECT 'Setup verification:' as status;
SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') as user_role_enum_exists;
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') as role_column_exists;
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') as function_exists;
SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') as trigger_exists;
