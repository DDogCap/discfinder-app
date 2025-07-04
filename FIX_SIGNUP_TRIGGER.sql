-- Fix the signup trigger to handle errors gracefully
-- Run this in your Supabase SQL Editor

-- Create a safer version of the linking function
CREATE OR REPLACE FUNCTION link_imported_profile()
RETURNS TRIGGER AS $$
DECLARE
    imported_profile RECORD;
    profile_exists BOOLEAN := FALSE;
BEGIN
    -- First check if a profile already exists for this user
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = NEW.id) INTO profile_exists;
    
    IF profile_exists THEN
        -- Profile already exists, don't create another one
        RETURN NEW;
    END IF;

    -- Look for an existing imported profile in staging with this email
    BEGIN
        SELECT * INTO imported_profile 
        FROM imported_profiles_staging 
        WHERE email = NEW.email;
        
        IF FOUND THEN
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
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- If there's any error with the staging table, fall back to normal profile creation
            RAISE WARNING 'Error accessing staging table: %', SQLERRM;
    END;

    -- No imported profile found or error occurred, proceed with normal profile creation
    BEGIN
        INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            CASE
                WHEN NEW.email = 'galen.adams@dropzonepaintball.com' THEN 'admin'::user_role
                ELSE 'user'::user_role
            END,
            NOW(),
            NOW()
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the error but don't fail the user creation
            RAISE WARNING 'Error creating profile: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION link_imported_profile();

-- Grant necessary permissions
GRANT SELECT, DELETE ON imported_profiles_staging TO authenticated;
GRANT INSERT, SELECT, UPDATE ON profiles TO authenticated;
