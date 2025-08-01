-- Add Profile Import Fields and Avatar Support
-- Run this in your Supabase SQL Editor to add fields needed for profile import

-- Add new fields to profiles table for import and enhanced functionality
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS legacy_row_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pdga_number INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_profile TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sms_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create a separate table for imported profiles that haven't signed up yet
CREATE TABLE IF NOT EXISTS imported_profiles_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'user',
    legacy_row_id TEXT,
    pdga_number INTEGER,
    facebook_profile TEXT,
    instagram_handle TEXT,
    sms_number TEXT,
    phone_number TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on legacy_row_id for efficient lookups during import
CREATE INDEX IF NOT EXISTS idx_profiles_legacy_row_id ON profiles(legacy_row_id);

-- Create index on pdga_number for efficient searches
CREATE INDEX IF NOT EXISTS idx_profiles_pdga_number ON profiles(pdga_number);

-- Update the Profile type comment for documentation
COMMENT ON TABLE profiles IS 'User profiles extending auth.users with import support and enhanced fields';
COMMENT ON COLUMN profiles.legacy_row_id IS 'Original row ID from previous Glide app for mapping imported data';
COMMENT ON COLUMN profiles.pdga_number IS 'Professional Disc Golf Association membership number';
COMMENT ON COLUMN profiles.facebook_profile IS 'Facebook profile URL or username';
COMMENT ON COLUMN profiles.instagram_handle IS 'Instagram handle without @ symbol';
COMMENT ON COLUMN profiles.sms_number IS 'SMS/text message phone number';
COMMENT ON COLUMN profiles.phone_number IS 'Primary phone number';
COMMENT ON COLUMN profiles.avatar_url IS 'URL to user avatar/profile photo in Supabase Storage';

-- Create a function to handle profile imports from legacy system
CREATE OR REPLACE FUNCTION import_legacy_profile(
    p_email TEXT,
    p_full_name TEXT DEFAULT '',
    p_role user_role DEFAULT 'user',
    p_legacy_row_id TEXT DEFAULT NULL,
    p_pdga_number INTEGER DEFAULT NULL,
    p_facebook_profile TEXT DEFAULT NULL,
    p_instagram_handle TEXT DEFAULT NULL,
    p_sms_number TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    staging_id UUID;
    existing_profile_id UUID;
    existing_staging_id UUID;
BEGIN
    -- First check if this profile already exists in the main profiles table
    SELECT id INTO existing_profile_id
    FROM profiles
    WHERE email = p_email
       OR (p_legacy_row_id IS NOT NULL AND legacy_row_id = p_legacy_row_id);

    IF existing_profile_id IS NOT NULL THEN
        -- Update existing profile with new data
        UPDATE profiles SET
            full_name = COALESCE(p_full_name, full_name),
            role = COALESCE(p_role, role),
            legacy_row_id = COALESCE(p_legacy_row_id, legacy_row_id),
            pdga_number = COALESCE(p_pdga_number, pdga_number),
            facebook_profile = COALESCE(p_facebook_profile, facebook_profile),
            instagram_handle = COALESCE(p_instagram_handle, instagram_handle),
            sms_number = COALESCE(p_sms_number, sms_number),
            phone_number = COALESCE(p_phone_number, phone_number),
            avatar_url = COALESCE(p_avatar_url, avatar_url),
            updated_at = NOW()
        WHERE id = existing_profile_id;

        RETURN existing_profile_id;
    ELSE
        -- Check if already exists in staging
        SELECT id INTO existing_staging_id
        FROM imported_profiles_staging
        WHERE email = p_email
           OR (p_legacy_row_id IS NOT NULL AND legacy_row_id = p_legacy_row_id);

        IF existing_staging_id IS NOT NULL THEN
            -- Update existing staging record
            UPDATE imported_profiles_staging SET
                full_name = COALESCE(p_full_name, full_name),
                role = COALESCE(p_role, role),
                legacy_row_id = COALESCE(p_legacy_row_id, legacy_row_id),
                pdga_number = COALESCE(p_pdga_number, pdga_number),
                facebook_profile = COALESCE(p_facebook_profile, facebook_profile),
                instagram_handle = COALESCE(p_instagram_handle, instagram_handle),
                sms_number = COALESCE(p_sms_number, sms_number),
                phone_number = COALESCE(p_phone_number, phone_number),
                avatar_url = COALESCE(p_avatar_url, avatar_url),
                updated_at = NOW()
            WHERE id = existing_staging_id;

            RETURN existing_staging_id;
        ELSE
            -- Insert new staging record
            INSERT INTO imported_profiles_staging (
                email, full_name, role, legacy_row_id,
                pdga_number, facebook_profile, instagram_handle,
                sms_number, phone_number, avatar_url,
                created_at, updated_at
            ) VALUES (
                p_email, p_full_name, p_role, p_legacy_row_id,
                p_pdga_number, p_facebook_profile, p_instagram_handle,
                p_sms_number, p_phone_number, p_avatar_url,
                NOW(), NOW()
            ) RETURNING id INTO staging_id;

            RETURN staging_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to link imported profiles when users sign up
CREATE OR REPLACE FUNCTION link_imported_profile()
RETURNS TRIGGER AS $$
DECLARE
    imported_profile RECORD;
BEGIN
    -- Look for an existing imported profile in staging with this email
    SELECT * INTO imported_profile
    FROM imported_profiles_staging
    WHERE email = NEW.email;

    IF imported_profile IS NOT NULL THEN
        -- Create profile using imported data
        INSERT INTO profiles (
            id, email, full_name, role, legacy_row_id,
            pdga_number, facebook_profile, instagram_handle,
            sms_number, phone_number, avatar_url,
            created_at, updated_at
        ) VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', imported_profile.full_name),
            imported_profile.role,
            imported_profile.legacy_row_id,
            imported_profile.pdga_number,
            imported_profile.facebook_profile,
            imported_profile.instagram_handle,
            imported_profile.sms_number,
            imported_profile.phone_number,
            imported_profile.avatar_url,
            NOW(),
            NOW()
        );

        -- Remove from staging since it's now linked
        DELETE FROM imported_profiles_staging WHERE id = imported_profile.id;

        RETURN NEW;
    ELSE
        -- No imported profile found, proceed with normal profile creation
        INSERT INTO profiles (id, email, full_name, role)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            CASE
                WHEN NEW.email = 'your-admin-email@example.com' THEN 'admin'::user_role
                ELSE 'user'::user_role
            END
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing trigger to use the new function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION link_imported_profile();

-- Create a view for imported profiles that haven't signed up yet
CREATE OR REPLACE VIEW imported_profiles AS
SELECT
    *,
    true as needs_signup
FROM imported_profiles_staging;

-- Grant appropriate permissions
GRANT SELECT ON imported_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION import_legacy_profile TO service_role;
GRANT EXECUTE ON FUNCTION link_imported_profile TO service_role;
