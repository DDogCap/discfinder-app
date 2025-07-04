-- Update database views to include rack_id field
-- This ensures rack_id is available in search results and admin dashboard

-- Update the public view to include rack_id
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
  AND (fd.return_status IS NULL OR fd.return_status = 'Found');

-- Grant permissions
GRANT SELECT ON public_found_discs TO authenticated, anon;

-- Update the admin view to include rack_id (it should already have it from ADD_RACK_ID.sql, but let's make sure)
DROP VIEW IF EXISTS admin_found_discs;
CREATE OR REPLACE VIEW admin_found_discs AS
SELECT
    fd.*,
    s.name as source_name,
    p.email as finder_email,
    p.full_name as finder_name,
    eb.email as entered_by_email,
    eb.full_name as entered_by_full_name,
    rb.email as returned_by_email,
    rb.full_name as returned_by_full_name,
    COALESCE(ca.contact_count, 0) as contact_attempts_count,
    ca.last_contact_date,
    ca.last_contact_method
FROM found_discs fd
LEFT JOIN sources s ON fd.source_id = s.id
LEFT JOIN profiles p ON fd.finder_id = p.id
LEFT JOIN profiles eb ON fd.entered_by_profile_id = eb.id
LEFT JOIN profiles rb ON fd.returned_by_profile_id = rb.id
LEFT JOIN (
    SELECT
        found_disc_id,
        COUNT(*) as contact_count,
        MAX(attempted_at) as last_contact_date,
        (SELECT contact_method FROM contact_attempts ca2
         WHERE ca2.found_disc_id = ca.found_disc_id
         ORDER BY attempted_at DESC LIMIT 1) as last_contact_method
    FROM contact_attempts ca
    GROUP BY found_disc_id
) ca ON fd.id = ca.found_disc_id
ORDER BY fd.created_at DESC;

-- Grant permissions to admin view
GRANT SELECT ON admin_found_discs TO authenticated;

-- Show current rack_id statistics
SELECT 
    'Updated views with rack_id' as status,
    COUNT(*) as total_discs,
    COUNT(rack_id) as discs_with_rack_id,
    MIN(rack_id) as min_rack_id,
    MAX(rack_id) as max_rack_id
FROM found_discs;
