-- Update the public_found_discs view to include image_urls
-- Run this in your Supabase SQL Editor

-- Drop the existing view if it exists
DROP VIEW IF EXISTS public_found_discs;

-- Recreate the view with image_urls included
CREATE OR REPLACE VIEW public_found_discs AS
SELECT 
    id,
    brand,
    mold,  -- Using mold instead of model
    disc_type,
    color,
    condition,
    location_found,
    found_date,
    created_at,
    image_urls,  -- Include images for identification
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
