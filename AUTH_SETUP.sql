-- Authentication and Role-Based Access Control Setup
-- Run this in your Supabase SQL Editor

-- Create user roles enum
CREATE TYPE user_role AS ENUM ('guest', 'user', 'admin');

-- Add role column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';

-- Set your admin email here (replace with your actual email)
-- You'll need to sign up with this email to become admin
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';

-- Create a function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    -- Change this email to your actual admin email
    CASE
      WHEN NEW.email = 'your-admin-email@example.com' THEN 'admin'::user_role
      ELSE 'user'::user_role
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Re-enable RLS and update policies
ALTER TABLE found_discs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view active found discs" ON found_discs;
DROP POLICY IF EXISTS "Finder can manage their found discs" ON found_discs;

-- New RLS policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "System can insert profiles" ON profiles
    FOR INSERT WITH CHECK (true);

-- New RLS policies for found_discs
-- Guests and users can view basic info (no sensitive details)
CREATE POLICY "Anyone can view found discs basic info" ON found_discs
    FOR SELECT USING (status = 'active');

-- Only authenticated users can insert found discs
CREATE POLICY "Authenticated users can insert found discs" ON found_discs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own found discs
CREATE POLICY "Users can update own found discs" ON found_discs
    FOR UPDATE USING (auth.uid() = finder_id);

-- Admins can do anything
CREATE POLICY "Admins can manage all found discs" ON found_discs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Create a function to check user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS user_role AS $$
DECLARE
    user_role_result user_role;
BEGIN
    IF user_id IS NULL THEN
        RETURN 'guest'::user_role;
    END IF;
    
    SELECT role INTO user_role_result
    FROM profiles
    WHERE id = user_id;
    
    RETURN COALESCE(user_role_result, 'guest'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for public disc information (what guests can see)
CREATE OR REPLACE VIEW public_found_discs AS
SELECT 
    id,
    brand,
    model,
    disc_type,
    color,
    condition,
    location_found,
    found_date,
    created_at,
    -- Hide sensitive information for guests
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE weight
    END as weight,
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE plastic_type
    END as plastic_type,
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE stamp_text
    END as stamp_text,
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE phone_number
    END as phone_number,
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE name_on_disc
    END as name_on_disc,
    CASE 
        WHEN get_user_role() = 'guest' THEN 'Contact information available to registered users'
        ELSE description
    END as description
FROM found_discs
WHERE status = 'active';

-- Grant access to the view
GRANT SELECT ON public_found_discs TO anon, authenticated;
