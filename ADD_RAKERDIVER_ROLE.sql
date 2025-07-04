-- STEP 2: Add RakerDiver Tables and Policies
-- Run this AFTER running STEP1_ADD_RAKERDIVER_ENUM.sql
-- Make sure the enum step completed successfully first

-- Update the get_user_role function to handle rakerdiver role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS user_role AS $$
DECLARE
    user_role_result user_role;
BEGIN
    IF user_id IS NULL THEN
        RETURN 'guest'::user_role;
    END IF;

    SELECT role INTO user_role_result
    FROM profiles
    WHERE id = user_id;

    RETURN COALESCE(user_role_result, 'guest'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create bulk_turnins table
CREATE TABLE bulk_turnins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rakerdiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    location_collected TEXT NOT NULL, -- e.g., "Jones East North Pond"
    collection_date DATE NOT NULL,
    collection_time TIME,
    disc_count INTEGER NOT NULL CHECK (disc_count > 0),
    turnin_location TEXT NOT NULL, -- e.g., "L&F Booth in Emporia"
    turnin_date DATE NOT NULL,
    turnin_time TIME,
    notes TEXT, -- Additional notes about the collection/turn-in
    admin_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES profiles(id), -- admin who verified
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bulk_turnin_payments table
CREATE TABLE bulk_turnin_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bulk_turnin_id UUID REFERENCES bulk_turnins(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    payment_method TEXT, -- e.g., "cash", "venmo", "check"
    payment_date DATE,
    payment_notes TEXT,
    created_by UUID REFERENCES profiles(id) NOT NULL, -- admin who created payment record
    rakerdiver_confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_bulk_turnins_rakerdiver_id ON bulk_turnins(rakerdiver_id);
CREATE INDEX idx_bulk_turnins_collection_date ON bulk_turnins(collection_date);
CREATE INDEX idx_bulk_turnins_admin_verified ON bulk_turnins(admin_verified);
CREATE INDEX idx_bulk_turnin_payments_bulk_turnin_id ON bulk_turnin_payments(bulk_turnin_id);
CREATE INDEX idx_bulk_turnin_payments_created_by ON bulk_turnin_payments(created_by);

-- Create RLS policies for bulk_turnins
ALTER TABLE bulk_turnins ENABLE ROW LEVEL SECURITY;

-- RakerDivers can view and manage their own turn-ins
CREATE POLICY "RakerDivers can view own turnins" ON bulk_turnins
    FOR SELECT USING (
        auth.uid() = rakerdiver_id AND
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'rakerdiver'
        )
    );

CREATE POLICY "RakerDivers can insert own turnins" ON bulk_turnins
    FOR INSERT WITH CHECK (
        auth.uid() = rakerdiver_id AND
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'rakerdiver'
        )
    );

CREATE POLICY "RakerDivers can update own unverified turnins" ON bulk_turnins
    FOR UPDATE USING (
        auth.uid() = rakerdiver_id AND
        admin_verified = FALSE AND
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'rakerdiver'
        )
    );

-- Admins can view and manage all turn-ins
CREATE POLICY "Admins can manage all turnins" ON bulk_turnins
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Create RLS policies for bulk_turnin_payments
ALTER TABLE bulk_turnin_payments ENABLE ROW LEVEL SECURITY;

-- RakerDivers can view payments for their turn-ins
CREATE POLICY "RakerDivers can view own payments" ON bulk_turnin_payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM bulk_turnins bt
            JOIN profiles p ON p.id = bt.rakerdiver_id
            WHERE bt.id = bulk_turnin_payments.bulk_turnin_id
            AND p.id = auth.uid()
            AND p.role = 'rakerdiver'
        )
    );

-- RakerDivers can update confirmation status of their payments
CREATE POLICY "RakerDivers can confirm own payments" ON bulk_turnin_payments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM bulk_turnins bt
            JOIN profiles p ON p.id = bt.rakerdiver_id
            WHERE bt.id = bulk_turnin_payments.bulk_turnin_id
            AND p.id = auth.uid()
            AND p.role = 'rakerdiver'
        )
    ) WITH CHECK (
        -- Only allow updating confirmation fields
        rakerdiver_confirmed IS NOT NULL OR confirmed_at IS NOT NULL
    );

-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments" ON bulk_turnin_payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
