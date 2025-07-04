-- Add return status tracking to found_discs table
-- Run this in your Supabase SQL Editor

-- Create enum for return status
CREATE TYPE return_status AS ENUM (
    'Found',
    'Returned to Owner',
    'Donated',
    'Sold',
    'Trashed'
);

-- Add return status columns to found_discs table
ALTER TABLE found_discs 
ADD COLUMN return_status return_status DEFAULT 'Found',
ADD COLUMN returned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN returned_notes TEXT;

-- Update existing records to have 'Found' status
UPDATE found_discs 
SET return_status = 'Found' 
WHERE return_status IS NULL;

-- Create index for faster filtering
CREATE INDEX idx_found_discs_return_status ON found_discs(return_status);

-- Create function to update return status (for admin use)
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

-- Grant execute permission to authenticated users (admin check will be in app)
GRANT EXECUTE ON FUNCTION update_disc_return_status(UUID, return_status, TEXT) TO authenticated;

-- Update the public view to only show 'Found' discs
DROP VIEW IF EXISTS public_found_discs;

CREATE OR REPLACE VIEW public_found_discs AS
SELECT 
    id,
    brand,
    mold,
    disc_type,
    color,
    condition,
    location_found,
    found_date,
    created_at,
    image_urls,
    return_status,
    returned_at,
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
WHERE status = 'active' AND return_status = 'Found';  -- Only show 'Found' discs in search

-- Grant access to the updated view
GRANT SELECT ON public_found_discs TO anon, authenticated;

-- Create admin view that shows all discs regardless of return status
CREATE OR REPLACE VIEW admin_found_discs AS
SELECT 
    id,
    finder_id,
    brand,
    mold,
    disc_type,
    color,
    weight,
    condition,
    plastic_type,
    stamp_text,
    phone_number,
    name_on_disc,
    location_found,
    found_date,
    description,
    image_urls,
    status,
    return_status,
    returned_at,
    returned_notes,
    created_at,
    updated_at
FROM found_discs
WHERE status = 'active'
ORDER BY 
    CASE return_status 
        WHEN 'Found' THEN 1 
        ELSE 2 
    END,
    created_at DESC;

-- Grant access to admin view (app will check admin role)
GRANT SELECT ON admin_found_discs TO authenticated;
