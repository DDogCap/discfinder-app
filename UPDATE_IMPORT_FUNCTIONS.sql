-- Update Import Functions to use staging table
-- Run this after ADD_PROFILE_IMPORT_FIELDS.sql

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

-- Update the import function to use staging table
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

-- Update the linking function
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

-- Update the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION link_imported_profile();

-- Drop and recreate the view
DROP VIEW IF EXISTS imported_profiles;
CREATE VIEW imported_profiles AS
SELECT
    *,
    true as needs_signup
FROM imported_profiles_staging;

-- Grant permissions
GRANT SELECT ON imported_profiles TO authenticated;
GRANT SELECT ON imported_profiles_staging TO authenticated;
GRANT EXECUTE ON FUNCTION import_legacy_profile TO service_role;
