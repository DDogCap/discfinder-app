-- Add Disc Condition and Type Enums
-- Run this in your Supabase SQL Editor to create enum types for disc condition and type

-- Create enum for disc condition
CREATE TYPE disc_condition AS ENUM (
    'excellent',
    'good', 
    'fair',
    'poor'
);

-- Create enum for disc type
CREATE TYPE disc_type AS ENUM (
    'putter',
    'approach',
    'midrange',
    'fairway_driver',
    'distance_driver'
);

-- Update found_discs table to use the new enum types
-- First, update existing data to use valid enum values

-- Update condition field - map existing text values to enum values
UPDATE found_discs 
SET condition = CASE 
    WHEN LOWER(condition) LIKE '%excellent%' OR LOWER(condition) LIKE '%mint%' OR LOWER(condition) LIKE '%new%' THEN 'excellent'
    WHEN LOWER(condition) LIKE '%good%' OR LOWER(condition) LIKE '%fine%' OR condition IS NULL OR condition = 'not specified' THEN 'good'
    WHEN LOWER(condition) LIKE '%fair%' OR LOWER(condition) LIKE '%ok%' OR LOWER(condition) LIKE '%okay%' THEN 'fair'
    WHEN LOWER(condition) LIKE '%poor%' OR LOWER(condition) LIKE '%bad%' OR LOWER(condition) LIKE '%damaged%' THEN 'poor'
    ELSE 'good'  -- Default fallback
END
WHERE condition IS NULL OR condition NOT IN ('excellent', 'good', 'fair', 'poor');

-- Update disc_type field - map existing text values to enum values
UPDATE found_discs 
SET disc_type = CASE 
    WHEN LOWER(disc_type) LIKE '%putter%' THEN 'putter'
    WHEN LOWER(disc_type) LIKE '%approach%' THEN 'approach'
    WHEN LOWER(disc_type) LIKE '%mid%' THEN 'midrange'
    WHEN LOWER(disc_type) LIKE '%fairway%' OR LOWER(disc_type) LIKE '%control%' THEN 'fairway_driver'
    WHEN LOWER(disc_type) LIKE '%distance%' OR LOWER(disc_type) LIKE '%driver%' THEN 'distance_driver'
    ELSE NULL  -- Leave as NULL if we can't determine type
END
WHERE disc_type IS NOT NULL AND disc_type NOT IN ('putter', 'approach', 'midrange', 'fairway_driver', 'distance_driver');

-- Now alter the table columns to use the enum types
ALTER TABLE found_discs 
ALTER COLUMN condition TYPE disc_condition USING condition::disc_condition;

ALTER TABLE found_discs 
ALTER COLUMN disc_type TYPE disc_type USING disc_type::disc_type;

-- Set default value for condition
ALTER TABLE found_discs 
ALTER COLUMN condition SET DEFAULT 'good';

-- Add comments for documentation
COMMENT ON COLUMN found_discs.condition IS 'Physical condition of the disc (excellent, good, fair, poor)';
COMMENT ON COLUMN found_discs.disc_type IS 'Type of disc (putter, approach, midrange, fairway_driver, distance_driver)';

-- Update the views to reflect the enum changes
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
  AND (fd.return_status IS NULL OR fd.return_status = 'Found');

-- Grant access to the updated view
GRANT SELECT ON public_found_discs TO anon, authenticated;

-- Show summary of changes
SELECT
    'Total found discs' as metric,
    COUNT(*) as count
FROM found_discs
UNION ALL
SELECT
    'Discs with excellent condition' as metric,
    COUNT(*) as count
FROM found_discs
WHERE condition = 'excellent'
UNION ALL
SELECT
    'Discs with good condition' as metric,
    COUNT(*) as count
FROM found_discs
WHERE condition = 'good'
UNION ALL
SELECT
    'Discs with fair condition' as metric,
    COUNT(*) as count
FROM found_discs
WHERE condition = 'fair'
UNION ALL
SELECT
    'Discs with poor condition' as metric,
    COUNT(*) as count
FROM found_discs
WHERE condition = 'poor'
UNION ALL
SELECT
    'Discs with disc_type set' as metric,
    COUNT(*) as count
FROM found_discs
WHERE disc_type IS NOT NULL
ORDER BY metric;
