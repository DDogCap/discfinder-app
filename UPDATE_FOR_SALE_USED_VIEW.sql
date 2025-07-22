-- STEP 2: Update views and functions to use the new 'For Sale Used' enum value
-- Run this AFTER running ADD_FOR_SALE_USED_STATUS.sql and waiting for it to complete

-- Update the update_disc_return_status function to handle the new status
-- (The function should already work with any valid enum value, but let's make sure)
CREATE OR REPLACE FUNCTION update_disc_return_status(
    disc_id UUID,
    new_status return_status,
    notes TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE found_discs 
    SET 
        return_status = new_status,
        returned_at = CASE 
            WHEN new_status != 'Found' THEN NOW() 
            ELSE NULL 
        END,
        returned_notes = notes,
        updated_at = NOW()
    WHERE id = disc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the public view to include 'For Sale Used' discs in search results
-- (Since these are discs that are available for purchase, they should be visible)
DROP VIEW IF EXISTS public_found_discs;
CREATE OR REPLACE VIEW public_found_discs AS
SELECT
    fd.id,
    fd.rack_id,
    fd.brand,
    fd.mold,
    fd.disc_type,
    fd.color,
    fd.condition,
    fd.location_found,
    fd.found_date,
    fd.created_at,
    fd.image_urls,
    fd.return_status,
    fd.returned_at,
    s.name as source_name,
    -- Hide sensitive information for guests
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.weight
    END as weight,
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.plastic_type
    END as plastic_type,
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.stamp_text
    END as stamp_text,
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.phone_number
    END as phone_number,
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.name_on_disc
    END as name_on_disc,
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.owner_email
    END as owner_email,
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.owner_pdga_number
    END as owner_pdga_number,
    CASE
        WHEN get_user_role() = 'guest' THEN 'Contact information available to registered users'
        ELSE fd.description
    END as description,
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.finder_id
    END as finder_id,
    CASE
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.returned_notes
    END as returned_notes
FROM found_discs fd
LEFT JOIN sources s ON fd.source_id = s.id
WHERE fd.status = 'active'
  AND (fd.return_status IS NULL OR fd.return_status IN ('Found', 'For Sale Used'));

-- Grant access to the updated view
GRANT SELECT ON public_found_discs TO anon, authenticated;
