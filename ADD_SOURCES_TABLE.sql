-- Add sources table for disc found locations
-- This provides a dropdown of predefined locations where discs are commonly found
-- Admins can manage these sources and set them as active/inactive

-- Create sources table
CREATE TABLE sources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT, -- Optional description for additional context
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0, -- For custom ordering in dropdown
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Add source_id to found_discs table
ALTER TABLE found_discs 
ADD COLUMN source_id UUID REFERENCES sources(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_sources_active ON sources(is_active);
CREATE INDEX idx_sources_sort_order ON sources(sort_order);
CREATE INDEX idx_found_discs_source_id ON found_discs(source_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW
    EXECUTE FUNCTION update_sources_updated_at();

-- Insert default "Other" source that will always be available
INSERT INTO sources (name, description, is_active, sort_order) 
VALUES ('Other', 'For locations not listed in the predefined sources', TRUE, 999);

-- Enable RLS on sources table
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sources table
-- Everyone can read active sources (for dropdown)
CREATE POLICY "Anyone can view active sources" ON sources
    FOR SELECT USING (is_active = TRUE);

-- Only admins can view all sources (including inactive)
CREATE POLICY "Admins can view all sources" ON sources
    FOR SELECT USING (get_user_role() = 'admin');

-- Only admins can insert sources
CREATE POLICY "Admins can insert sources" ON sources
    FOR INSERT WITH CHECK (get_user_role() = 'admin');

-- Only admins can update sources
CREATE POLICY "Admins can update sources" ON sources
    FOR UPDATE USING (get_user_role() = 'admin');

-- Only admins can delete sources (though we'll typically just set inactive)
CREATE POLICY "Admins can delete sources" ON sources
    FOR DELETE USING (get_user_role() = 'admin');

-- Update the public_found_discs view to include source information
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
        WHEN get_user_role() = 'guest' THEN 'Contact information available to registered users'
        ELSE fd.description
    END as description,
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.finder_id
    END as finder_id,
    -- Return status information (visible to all authenticated users)
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.return_status
    END as return_status,
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.returned_at
    END as returned_at,
    CASE 
        WHEN get_user_role() = 'guest' THEN NULL
        ELSE fd.returned_notes
    END as returned_notes
FROM found_discs fd
LEFT JOIN sources s ON fd.source_id = s.id
WHERE fd.status = 'active' 
  AND (fd.return_status IS NULL OR fd.return_status = 'Found');

-- Update the admin_found_discs view to include source information
DROP VIEW IF EXISTS admin_found_discs;
CREATE OR REPLACE VIEW admin_found_discs AS
SELECT 
    fd.*,
    s.name as source_name,
    p.email as finder_email,
    p.full_name as finder_name
FROM found_discs fd
LEFT JOIN sources s ON fd.source_id = s.id
LEFT JOIN profiles p ON fd.finder_id = p.id
WHERE get_user_role() = 'admin';

-- Grant necessary permissions
GRANT SELECT ON sources TO authenticated;
GRANT ALL ON sources TO service_role;
