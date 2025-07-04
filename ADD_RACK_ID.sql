-- Add rack_id field to found_discs table for user-friendly disc identification
-- This provides an integer ID that's easier to use for physical disc management

-- Add rack_id column as an auto-incrementing integer
ALTER TABLE found_discs 
ADD COLUMN rack_id SERIAL UNIQUE;

-- Create index for fast lookups
CREATE INDEX idx_found_discs_rack_id ON found_discs(rack_id);

-- Add comment for documentation
COMMENT ON COLUMN found_discs.rack_id IS 'User-friendly integer ID for disc rack management and physical organization';

-- Create function to get next rack_id (for manual insertion if needed)
CREATE OR REPLACE FUNCTION get_next_rack_id()
RETURNS INTEGER AS $$
DECLARE
    next_id INTEGER;
BEGIN
    SELECT COALESCE(MAX(rack_id), 0) + 1 INTO next_id FROM found_discs;
    RETURN next_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_next_rack_id() TO service_role;

-- Update the import function to handle rack_id from CSV
CREATE OR REPLACE FUNCTION import_legacy_found_disc_with_rack_id(
    p_legacy_row_id TEXT,
    p_csv_id INTEGER DEFAULT NULL, -- The integer ID from your CSV
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
    v_rack_id INTEGER;
BEGIN
    -- Generate new UUID for the found disc
    v_found_disc_id := gen_random_uuid();
    
    -- Set finder to demo user (will be updated later based on entered_by)
    SELECT id INTO v_finder_profile_id 
    FROM profiles 
    WHERE email = 'demo@discfinder.app' 
    LIMIT 1;
    
    -- If no demo user found, use the first admin user
    IF v_finder_profile_id IS NULL THEN
        SELECT id INTO v_finder_profile_id 
        FROM profiles 
        WHERE role = 'admin' 
        LIMIT 1;
    END IF;
    
    -- Look up source by legacy_row_id
    IF p_source_legacy_id IS NOT NULL THEN
        SELECT id INTO v_source_id 
        FROM sources 
        WHERE legacy_row_id = p_source_legacy_id;
    END IF;
    
    -- Use CSV ID if provided, otherwise get next available rack_id
    IF p_csv_id IS NOT NULL THEN
        v_rack_id := p_csv_id;
    ELSE
        v_rack_id := get_next_rack_id();
    END IF;
    
    -- Insert the found disc record
    INSERT INTO found_discs (
        id,
        rack_id,
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
        v_rack_id,
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
GRANT EXECUTE ON FUNCTION import_legacy_found_disc_with_rack_id(
    TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER,
    TEXT, TEXT, DATE, TIMESTAMP WITH TIME ZONE, TEXT, TIMESTAMP WITH TIME ZONE,
    TEXT, return_status, TEXT, TEXT[], TEXT
) TO service_role;

-- Create trigger to ensure rack_id is always set for new records
CREATE OR REPLACE FUNCTION ensure_rack_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If rack_id is not set, get the next available one
    IF NEW.rack_id IS NULL THEN
        NEW.rack_id := get_next_rack_id();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new found_discs
CREATE TRIGGER trigger_ensure_rack_id
    BEFORE INSERT ON found_discs
    FOR EACH ROW
    EXECUTE FUNCTION ensure_rack_id();

-- Update admin view to include rack_id
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
    fd.rack_id DESC; -- Order by rack_id for easier physical management
