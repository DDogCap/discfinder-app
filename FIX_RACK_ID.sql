-- Fix rack_id field to use CSV values instead of auto-generated sequential values
-- This script corrects the issue where SERIAL auto-assigned values conflict with CSV values

-- Step 1: Remove the unique constraint temporarily
ALTER TABLE found_discs DROP CONSTRAINT IF EXISTS found_discs_rack_id_key;

-- Step 2: Drop the existing index
DROP INDEX IF EXISTS idx_found_discs_rack_id;

-- Step 3: Remove the NOT NULL constraint from rack_id
ALTER TABLE found_discs ALTER COLUMN rack_id DROP NOT NULL;

-- Step 4: Set all rack_id values to NULL to clear conflicts
UPDATE found_discs SET rack_id = NULL;

-- Step 5: Reset the sequence to start from a high number (higher than any CSV value)
-- First, let's set it to start from 10000 to avoid conflicts
ALTER SEQUENCE found_discs_rack_id_seq RESTART WITH 10000;

-- Step 6: Recreate the unique constraint and index (allowing NULL values)
ALTER TABLE found_discs ADD CONSTRAINT found_discs_rack_id_key UNIQUE (rack_id);
CREATE INDEX idx_found_discs_rack_id ON found_discs(rack_id);

-- Step 7: Update the trigger function to handle NULL rack_id properly
CREATE OR REPLACE FUNCTION ensure_rack_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If rack_id is not set, get the next available one
    IF NEW.rack_id IS NULL THEN
        NEW.rack_id := nextval('found_discs_rack_id_seq');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Show current status
SELECT 
    'After cleanup' as status,
    COUNT(*) as total_discs,
    COUNT(rack_id) as discs_with_rack_id,
    MIN(rack_id) as min_rack_id,
    MAX(rack_id) as max_rack_id
FROM found_discs;
