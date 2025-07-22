-- Add 'For Sale Used' to return_status enum
-- IMPORTANT: Run this in TWO SEPARATE steps in your Supabase SQL Editor

-- STEP 1: Add the new enum value (run this first, then wait for it to complete)
ALTER TYPE return_status ADD VALUE 'For Sale Used';

-- Add comment for documentation
COMMENT ON TYPE return_status IS 'Status of found disc: Found (available for return), Returned to Owner, Donated, Sold, Trashed, For Sale Used (available for purchase)';
