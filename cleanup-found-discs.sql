-- Cleanup Found Discs Data
-- Run this in your Supabase SQL Editor to fix remaining data issues

-- 1. Set all null finder_id to admin user
-- Replace 'db159239-6d39-4d43-8289-99bd8f18f41a' with your actual admin user ID
UPDATE found_discs 
SET finder_id = 'db159239-6d39-4d43-8289-99bd8f18f41a'
WHERE finder_id IS NULL;

-- 2. Set all empty/null brands to 'not specified'
UPDATE found_discs 
SET brand = 'not specified'
WHERE brand IS NULL OR brand = '';

-- 3. Set all empty/null conditions to 'good' (valid enum value)
UPDATE found_discs 
SET condition = 'good'
WHERE condition IS NULL;

-- 4. Normalize phone numbers to E.164 format
-- This handles US phone numbers (10 digits -> +1XXXXXXXXXX)
UPDATE found_discs 
SET phone_number = '+1' || regexp_replace(phone_number, '[^0-9]', '', 'g')
WHERE phone_number IS NOT NULL 
  AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 10
  AND phone_number NOT LIKE '+%';

-- Handle 11-digit numbers starting with 1
UPDATE found_discs 
SET phone_number = '+' || regexp_replace(phone_number, '[^0-9]', '', 'g')
WHERE phone_number IS NOT NULL 
  AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 11
  AND regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE '1%'
  AND phone_number NOT LIKE '+%';

-- 5. Clean descriptions by removing color information
-- This is a simplified version - removes common color words from descriptions
UPDATE found_discs 
SET description = trim(regexp_replace(description, '\y(red|blue|green|yellow|orange|purple|pink|black|white|clear|transparent)\y', '', 'gi'))
WHERE description IS NOT NULL 
  AND color IS NOT NULL 
  AND description ~* '\y(red|blue|green|yellow|orange|purple|pink|black|white|clear|transparent)\y';

-- Clean up extra spaces in descriptions
UPDATE found_discs 
SET description = regexp_replace(description, '\s+', ' ', 'g')
WHERE description IS NOT NULL;

-- 6. Show cleanup statistics
SELECT 
    'Total found discs' as metric,
    COUNT(*) as count
FROM found_discs
UNION ALL
SELECT 
    'Discs with null finder_id' as metric,
    COUNT(*) as count
FROM found_discs 
WHERE finder_id IS NULL
UNION ALL
SELECT 
    'Discs with brand "not specified"' as metric,
    COUNT(*) as count
FROM found_discs 
WHERE brand = 'not specified'
UNION ALL
SELECT 
    'Discs with condition "good"' as metric,
    COUNT(*) as count
FROM found_discs 
WHERE condition = 'good'
UNION ALL
SELECT 
    'Normalized phone numbers (+1...)' as metric,
    COUNT(*) as count
FROM found_discs 
WHERE phone_number LIKE '+1%'
UNION ALL
SELECT 
    'Unnormalized phone numbers' as metric,
    COUNT(*) as count
FROM found_discs 
WHERE phone_number IS NOT NULL 
  AND phone_number NOT LIKE '+%'
ORDER BY metric;
