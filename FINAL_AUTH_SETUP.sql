-- Final Authentication Setup - Manual Profile Creation
-- Run this to clean up and prepare for manual profile creation

-- Step 1: Remove the problematic trigger completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Step 2: Ensure the profiles table is set up correctly
-- Make sure we have the user_role enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('guest', 'user', 'admin');
    END IF;
END $$;

-- Make sure we have the role column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'user';
    END IF;
END $$;

-- Step 3: Set up RLS policies for manual profile creation
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for system" ON profiles;
DROP POLICY IF EXISTS "Enable update for own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;

-- Create new policies that work with manual creation
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Step 4: Create a helper function for manual profile creation (optional)
CREATE OR REPLACE FUNCTION create_user_profile(
    user_id UUID,
    user_email TEXT,
    user_name TEXT DEFAULT '',
    user_role user_role DEFAULT 'user'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (
        user_id,
        user_email,
        user_name,
        user_role,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Set your admin role (replace with your actual email)
-- After you sign up with your admin email, run this:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-actual-email@example.com';

-- Step 6: Verification queries
SELECT 'Setup complete!' as status;
SELECT 'Profiles table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;
