-- Add contact attempts table for tracking communication with disc owners
-- This allows logging all contact attempts made to reach disc owners
-- Supports both current admin users and legacy contact data import

-- Create contact_attempts table
CREATE TABLE contact_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    found_disc_id UUID NOT NULL REFERENCES found_discs(id) ON DELETE CASCADE,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    contact_method TEXT NOT NULL, -- 'SMS', 'Email', 'Phone', 'In Person', etc.
    message_content TEXT NOT NULL, -- what was sent/said
    attempted_by_profile_id UUID REFERENCES profiles(id), -- which admin (nullable)
    attempted_by_name TEXT, -- fallback if no profile link (nullable)
    response_received BOOLEAN DEFAULT FALSE,
    response_content TEXT, -- what they said back (nullable)
    notes TEXT, -- any additional notes (nullable)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_contact_attempts_found_disc_id ON contact_attempts(found_disc_id);
CREATE INDEX idx_contact_attempts_attempted_at ON contact_attempts(attempted_at);
CREATE INDEX idx_contact_attempts_attempted_by_profile_id ON contact_attempts(attempted_by_profile_id);

-- Add comments for documentation
COMMENT ON TABLE contact_attempts IS 'Log of all contact attempts made to disc owners';
COMMENT ON COLUMN contact_attempts.found_disc_id IS 'References the found disc this contact attempt is for';
COMMENT ON COLUMN contact_attempts.attempted_at IS 'When the contact attempt was made';
COMMENT ON COLUMN contact_attempts.contact_method IS 'How contact was attempted (SMS, Email, Phone, etc.)';
COMMENT ON COLUMN contact_attempts.message_content IS 'The actual message sent or conversation details';
COMMENT ON COLUMN contact_attempts.attempted_by_profile_id IS 'Which admin profile made the contact (nullable for legacy data)';
COMMENT ON COLUMN contact_attempts.attempted_by_name IS 'Name of person who made contact (fallback for legacy data)';
COMMENT ON COLUMN contact_attempts.response_received IS 'Whether the disc owner responded to this contact';
COMMENT ON COLUMN contact_attempts.response_content IS 'What the disc owner said in response';
COMMENT ON COLUMN contact_attempts.notes IS 'Additional notes about the contact attempt';

-- Enable Row Level Security
ALTER TABLE contact_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contact_attempts
-- Only admins can see and manage contact attempts (private communication)
CREATE POLICY "Only admins can manage contact attempts" ON contact_attempts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Grant necessary permissions
GRANT SELECT ON contact_attempts TO authenticated;
GRANT ALL ON contact_attempts TO service_role;

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_contact_attempts_updated_at
    BEFORE UPDATE ON contact_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_attempts_updated_at();
