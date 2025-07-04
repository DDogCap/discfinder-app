-- Add Found Disc Import Fields
-- Run this in your Supabase SQL Editor to add fields needed for found disc import

-- Add new fields to found_discs table for import and enhanced functionality
ALTER TABLE found_discs ADD COLUMN IF NOT EXISTS legacy_row_id TEXT UNIQUE;
ALTER TABLE found_discs ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE found_discs ADD COLUMN IF NOT EXISTS owner_pdga_number INTEGER;
ALTER TABLE found_discs ADD COLUMN IF NOT EXISTS returned_by_profile_id UUID REFERENCES profiles(id);
ALTER TABLE found_discs ADD COLUMN IF NOT EXISTS returned_by_name TEXT;
ALTER TABLE found_discs ADD COLUMN IF NOT EXISTS entered_by_profile_id UUID REFERENCES profiles(id);
ALTER TABLE found_discs ADD COLUMN IF NOT EXISTS entered_by_name TEXT;
ALTER TABLE found_discs ADD COLUMN IF NOT EXISTS entry_date TIMESTAMP WITH TIME ZONE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_found_discs_legacy_row_id ON found_discs(legacy_row_id);
CREATE INDEX IF NOT EXISTS idx_found_discs_owner_email ON found_discs(owner_email);
CREATE INDEX IF NOT EXISTS idx_found_discs_owner_pdga ON found_discs(owner_pdga_number);
CREATE INDEX IF NOT EXISTS idx_found_discs_returned_by_profile ON found_discs(returned_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_found_discs_entered_by_profile ON found_discs(entered_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_found_discs_entry_date ON found_discs(entry_date);

-- Add comments for documentation
COMMENT ON COLUMN found_discs.legacy_row_id IS 'Legacy row ID from Glide app for import mapping';
COMMENT ON COLUMN found_discs.owner_email IS 'Email address of disc owner (extracted from contact info)';
COMMENT ON COLUMN found_discs.owner_pdga_number IS 'PDGA number of disc owner if available';
COMMENT ON COLUMN found_discs.returned_by_profile_id IS 'Profile ID of person who returned the disc (for auditing)';
COMMENT ON COLUMN found_discs.returned_by_name IS 'Name of person who returned the disc (fallback for legacy data)';
COMMENT ON COLUMN found_discs.entered_by_profile_id IS 'Profile ID of person who entered the found disc';
COMMENT ON COLUMN found_discs.entered_by_name IS 'Name of person who entered the found disc (fallback for legacy data)';
COMMENT ON COLUMN found_discs.entry_date IS 'When the disc was originally entered into the system';

-- Create a function to handle found disc imports from legacy system
CREATE OR REPLACE FUNCTION import_legacy_found_disc(
    p_legacy_row_id TEXT,
    p_finder_email TEXT DEFAULT NULL,
    p_brand TEXT DEFAULT '',
    p_mold TEXT DEFAULT NULL,
    p_color TEXT DEFAULT '',
    p_description TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_name_on_disc TEXT DEFAULT NULL,
    p_owner_email TEXT DEFAULT NULL,
    p_owner_pdga_number INTEGER DEFAULT NULL,
    p_location_found TEXT DEFAULT 'Exact location unknown.',
    p_source_legacy_id TEXT DEFAULT NULL,
    p_found_date DATE DEFAULT NULL,
    p_entry_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_entered_by_name TEXT DEFAULT NULL,
    p_returned_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_returned_by_name TEXT DEFAULT NULL,
    p_return_status return_status DEFAULT 'Found',
    p_returned_notes TEXT DEFAULT NULL,
    p_image_urls TEXT[] DEFAULT NULL,
    p_private_identifier TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_found_disc_id UUID;
    v_finder_profile_id UUID;
    v_source_id UUID;
    v_entered_by_profile_id UUID;
    v_returned_by_profile_id UUID;
BEGIN
    -- Generate new UUID for the found disc
    v_found_disc_id := gen_random_uuid();
    
    -- Try to find finder profile by email
    IF p_finder_email IS NOT NULL THEN
        SELECT id INTO v_finder_profile_id 
        FROM profiles 
        WHERE email = p_finder_email;
    END IF;
    
    -- Try to find source by legacy_row_id
    IF p_source_legacy_id IS NOT NULL THEN
        SELECT id INTO v_source_id 
        FROM sources 
        WHERE legacy_row_id = p_source_legacy_id;
    END IF;
    
    -- Try to find entered_by profile (this will be mapped later)
    -- For now, we'll store the name and map profiles after import
    
    -- Try to find returned_by profile (this will be mapped later)
    -- For now, we'll store the name and map profiles after import
    
    -- Insert the found disc record
    INSERT INTO found_discs (
        id,
        legacy_row_id,
        finder_id,
        brand,
        mold,
        color,
        description,
        phone_number,
        name_on_disc,
        owner_email,
        owner_pdga_number,
        location_found,
        source_id,
        found_date,
        entry_date,
        entered_by_name,
        return_status,
        returned_at,
        returned_by_name,
        returned_notes,
        image_urls,
        stamp_text,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_found_disc_id,
        p_legacy_row_id,
        v_finder_profile_id,
        p_brand,
        p_mold,
        p_color,
        p_description,
        p_phone_number,
        p_name_on_disc,
        p_owner_email,
        p_owner_pdga_number,
        p_location_found,
        v_source_id,
        p_found_date,
        p_entry_date,
        p_entered_by_name,
        p_return_status,
        p_returned_date,
        p_returned_by_name,
        p_returned_notes,
        p_image_urls,
        p_private_identifier,
        'active',
        NOW(),
        NOW()
    );
    
    RETURN v_found_disc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role for import scripts
GRANT EXECUTE ON FUNCTION import_legacy_found_disc(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER,
    TEXT, TEXT, DATE, TIMESTAMP WITH TIME ZONE, TEXT, TIMESTAMP WITH TIME ZONE,
    TEXT, return_status, TEXT, TEXT[], TEXT
) TO service_role;

-- Update the admin view to include new fields and contact attempt counts
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
         WHERE ca2.found_disc_id = ca1.found_disc_id
         ORDER BY attempted_at DESC LIMIT 1) as last_contact_method
    FROM contact_attempts ca1
    GROUP BY found_disc_id
) ca ON fd.id = ca.found_disc_id
WHERE get_user_role() = 'admin'
ORDER BY
    CASE fd.return_status
        WHEN 'Found' THEN 1
        ELSE 2
    END,
    fd.created_at DESC;

-- Update the public view to include owner information for authenticated users
DROP VIEW IF EXISTS public_found_discs;
CREATE OR REPLACE VIEW public_found_discs AS
SELECT
    fd.id,
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

-- Grant necessary permissions
GRANT SELECT ON admin_found_discs TO authenticated;
GRANT SELECT ON public_found_discs TO anon, authenticated;
