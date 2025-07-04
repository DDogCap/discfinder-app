-- Fix the trigger that's causing 500 errors
-- The issue is likely in the handle_new_user function

-- Step 1: Drop the problematic trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Test user creation without the trigger
-- Try signing up now - it should work but won't create a profile

-- Step 3: Create a safer trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role_val user_role := 'user';
BEGIN
    -- Try to insert the profile
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            user_role_val,
            NOW(),
            NOW()
        );
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the specific error
            RAISE LOG 'Failed to create profile for user %: % %', NEW.id, SQLSTATE, SQLERRM;
            -- Don't fail the user creation, just log the error
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate the trigger (run this after testing step 2)
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 5: Alternative - Manual profile creation function
CREATE OR REPLACE FUNCTION create_profile_for_user(user_id UUID, user_email TEXT, user_name TEXT DEFAULT '')
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (
        user_id,
        user_email,
        user_name,
        'user'::user_role,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
