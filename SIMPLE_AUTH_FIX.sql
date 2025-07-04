-- Simple Authentication Fix
-- Run this if you're getting database errors when creating users

-- Step 1: Temporarily disable RLS to allow user creation
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop the problematic trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 3: Create the user_role enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('guest', 'user', 'admin');
    END IF;
END $$;

-- Step 4: Add role column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'user';
    END IF;
END $$;

-- Step 5: Create a simpler trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'user'::user_role  -- Default to user, we'll update admin manually
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 7: Set your admin role manually (replace with your email)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-actual-email@example.com';

-- Step 8: Re-enable RLS with simpler policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;

-- Create simpler policies
CREATE POLICY "Enable read access for users" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for users based on id" ON profiles
    FOR UPDATE USING (auth.uid() = id);
