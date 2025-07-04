-- Update database to change "model" to "mold"
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the view first (it depends on the model column)
DROP VIEW IF EXISTS public_found_discs;

-- Step 2: Add the new mold column
ALTER TABLE found_discs ADD COLUMN mold TEXT;

-- Step 3: Copy data from model to mold
UPDATE found_discs SET mold = model WHERE model IS NOT NULL;

-- Step 4: Drop the old model column (now safe to do)
ALTER TABLE found_discs DROP COLUMN model;

-- Step 5: Recreate the public view with mold instead of model
DROP VIEW IF EXISTS public_found_discs;

CREATE OR REPLACE VIEW public_found_discs AS
SELECT 
    id,
    brand,
    mold,  -- Changed from model to mold
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
    END as description,
    image_urls  -- Images are always visible to help with identification
FROM found_discs
WHERE status = 'active';

-- Grant access to the view
GRANT SELECT ON public_found_discs TO anon, authenticated;
