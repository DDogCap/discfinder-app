-- Bulk Turn-In Database Functions
-- Run this after ADD_RAKERDIVER_ROLE.sql

-- Function to create a new bulk turn-in record
CREATE OR REPLACE FUNCTION create_bulk_turnin(
    p_location_collected TEXT,
    p_collection_date DATE,
    p_disc_count INTEGER,
    p_turnin_location TEXT,
    p_turnin_date DATE,
    p_collection_time TIME DEFAULT NULL,
    p_turnin_time TIME DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_turnin_id UUID;
    user_role_check user_role;
BEGIN
    -- Check if user is a rakerdiver
    SELECT get_user_role() INTO user_role_check;
    IF user_role_check != 'rakerdiver' THEN
        RAISE EXCEPTION 'Only RakerDivers can create bulk turn-in records';
    END IF;
    
    -- Insert the new bulk turn-in record
    INSERT INTO bulk_turnins (
        rakerdiver_id,
        location_collected,
        collection_date,
        collection_time,
        disc_count,
        turnin_location,
        turnin_date,
        turnin_time,
        notes
    ) VALUES (
        auth.uid(),
        p_location_collected,
        p_collection_date,
        p_collection_time,
        p_disc_count,
        p_turnin_location,
        p_turnin_date,
        p_turnin_time,
        p_notes
    ) RETURNING id INTO new_turnin_id;
    
    RETURN new_turnin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify a bulk turn-in (admin only)
CREATE OR REPLACE FUNCTION verify_bulk_turnin(
    p_turnin_id UUID,
    p_verification_notes TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    user_role_check user_role;
BEGIN
    -- Check if user is an admin
    SELECT get_user_role() INTO user_role_check;
    IF user_role_check != 'admin' THEN
        RAISE EXCEPTION 'Only admins can verify bulk turn-in records';
    END IF;
    
    -- Update the turn-in record
    UPDATE bulk_turnins 
    SET 
        admin_verified = TRUE,
        verified_by = auth.uid(),
        verified_at = NOW(),
        verification_notes = p_verification_notes,
        updated_at = NOW()
    WHERE id = p_turnin_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bulk turn-in record not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a payment record (admin only)
CREATE OR REPLACE FUNCTION create_bulk_turnin_payment(
    p_bulk_turnin_id UUID,
    p_amount DECIMAL(10,2),
    p_payment_method TEXT DEFAULT NULL,
    p_payment_date DATE DEFAULT NULL,
    p_payment_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_payment_id UUID;
    user_role_check user_role;
    turnin_exists BOOLEAN;
BEGIN
    -- Check if user is an admin
    SELECT get_user_role() INTO user_role_check;
    IF user_role_check != 'admin' THEN
        RAISE EXCEPTION 'Only admins can create payment records';
    END IF;
    
    -- Check if the bulk turn-in exists
    SELECT EXISTS(SELECT 1 FROM bulk_turnins WHERE id = p_bulk_turnin_id) INTO turnin_exists;
    IF NOT turnin_exists THEN
        RAISE EXCEPTION 'Bulk turn-in record not found';
    END IF;
    
    -- Insert the payment record
    INSERT INTO bulk_turnin_payments (
        bulk_turnin_id,
        amount,
        payment_method,
        payment_date,
        payment_notes,
        created_by
    ) VALUES (
        p_bulk_turnin_id,
        p_amount,
        p_payment_method,
        p_payment_date,
        p_payment_notes,
        auth.uid()
    ) RETURNING id INTO new_payment_id;
    
    RETURN new_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to confirm payment receipt (rakerdiver only)
CREATE OR REPLACE FUNCTION confirm_payment_receipt(
    p_payment_id UUID
)
RETURNS void AS $$
DECLARE
    user_role_check user_role;
    is_owner BOOLEAN;
BEGIN
    -- Check if user is a rakerdiver
    SELECT get_user_role() INTO user_role_check;
    IF user_role_check != 'rakerdiver' THEN
        RAISE EXCEPTION 'Only RakerDivers can confirm payment receipt';
    END IF;
    
    -- Check if this payment belongs to the current user
    SELECT EXISTS(
        SELECT 1 FROM bulk_turnin_payments btp
        JOIN bulk_turnins bt ON bt.id = btp.bulk_turnin_id
        WHERE btp.id = p_payment_id AND bt.rakerdiver_id = auth.uid()
    ) INTO is_owner;
    
    IF NOT is_owner THEN
        RAISE EXCEPTION 'Payment record not found or access denied';
    END IF;
    
    -- Update the payment confirmation
    UPDATE bulk_turnin_payments 
    SET 
        rakerdiver_confirmed = TRUE,
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bulk turn-ins for a rakerdiver
CREATE OR REPLACE FUNCTION get_rakerdiver_turnins(
    p_rakerdiver_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
    id UUID,
    location_collected TEXT,
    collection_date DATE,
    collection_time TIME,
    disc_count INTEGER,
    turnin_location TEXT,
    turnin_date DATE,
    turnin_time TIME,
    notes TEXT,
    admin_verified BOOLEAN,
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    total_payments DECIMAL(10,2),
    confirmed_payments DECIMAL(10,2)
) AS $$
DECLARE
    user_role_check user_role;
BEGIN
    -- Check permissions
    SELECT get_user_role() INTO user_role_check;
    IF user_role_check = 'rakerdiver' AND p_rakerdiver_id != auth.uid() THEN
        RAISE EXCEPTION 'RakerDivers can only view their own records';
    ELSIF user_role_check NOT IN ('rakerdiver', 'admin') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    RETURN QUERY
    SELECT 
        bt.id,
        bt.location_collected,
        bt.collection_date,
        bt.collection_time,
        bt.disc_count,
        bt.turnin_location,
        bt.turnin_date,
        bt.turnin_time,
        bt.notes,
        bt.admin_verified,
        bt.verified_by,
        bt.verified_at,
        bt.verification_notes,
        bt.created_at,
        bt.updated_at,
        COALESCE(SUM(btp.amount), 0) as total_payments,
        COALESCE(SUM(CASE WHEN btp.rakerdiver_confirmed THEN btp.amount ELSE 0 END), 0) as confirmed_payments
    FROM bulk_turnins bt
    LEFT JOIN bulk_turnin_payments btp ON bt.id = btp.bulk_turnin_id
    WHERE bt.rakerdiver_id = p_rakerdiver_id
    GROUP BY bt.id, bt.location_collected, bt.collection_date, bt.collection_time, 
             bt.disc_count, bt.turnin_location, bt.turnin_date, bt.turnin_time, 
             bt.notes, bt.admin_verified, bt.verified_by, bt.verified_at, 
             bt.verification_notes, bt.created_at, bt.updated_at
    ORDER BY bt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin view for managing all bulk turn-ins
CREATE OR REPLACE VIEW admin_bulk_turnins AS
SELECT
    bt.id,
    bt.rakerdiver_id,
    p.full_name as rakerdiver_name,
    p.email as rakerdiver_email,
    bt.location_collected,
    bt.collection_date,
    bt.collection_time,
    bt.disc_count,
    bt.turnin_location,
    bt.turnin_date,
    bt.turnin_time,
    bt.notes,
    bt.admin_verified,
    bt.verified_by,
    vp.full_name as verified_by_name,
    bt.verified_at,
    bt.verification_notes,
    bt.created_at,
    bt.updated_at,
    COALESCE(SUM(btp.amount), 0) as total_payments,
    COALESCE(SUM(CASE WHEN btp.rakerdiver_confirmed THEN btp.amount ELSE 0 END), 0) as confirmed_payments,
    COUNT(btp.id) as payment_count
FROM bulk_turnins bt
JOIN profiles p ON bt.rakerdiver_id = p.id
LEFT JOIN profiles vp ON bt.verified_by = vp.id
LEFT JOIN bulk_turnin_payments btp ON bt.id = btp.bulk_turnin_id
GROUP BY bt.id, bt.rakerdiver_id, p.full_name, p.email, bt.location_collected,
         bt.collection_date, bt.collection_time, bt.disc_count, bt.turnin_location,
         bt.turnin_date, bt.turnin_time, bt.notes, bt.admin_verified, bt.verified_by,
         vp.full_name, bt.verified_at, bt.verification_notes, bt.created_at, bt.updated_at
ORDER BY
    CASE WHEN bt.admin_verified THEN 1 ELSE 0 END,
    bt.created_at DESC;

-- Grant access to admin view
GRANT SELECT ON admin_bulk_turnins TO authenticated;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_bulk_turnin(TEXT, DATE, INTEGER, TEXT, DATE, TIME, TIME, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_bulk_turnin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_bulk_turnin_payment(UUID, DECIMAL(10,2), TEXT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_payment_receipt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rakerdiver_turnins(UUID) TO authenticated;
