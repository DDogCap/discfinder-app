-- Analyze remaining unnormalized phone numbers
-- Run this to understand what phone numbers still need attention

-- 1. Show sample unnormalized phone numbers
SELECT 
    'Sample unnormalized phones' as category,
    phone_number,
    length(regexp_replace(phone_number, '[^0-9]', '', 'g')) as digit_count,
    regexp_replace(phone_number, '[^0-9]', '', 'g') as digits_only
FROM found_discs 
WHERE phone_number IS NOT NULL 
  AND phone_number NOT LIKE '+%'
LIMIT 10;

-- 2. Count by digit length
SELECT 
    'Phone numbers by digit count' as category,
    length(regexp_replace(phone_number, '[^0-9]', '', 'g')) as digit_count,
    COUNT(*) as count
FROM found_discs 
WHERE phone_number IS NOT NULL 
  AND phone_number NOT LIKE '+%'
GROUP BY length(regexp_replace(phone_number, '[^0-9]', '', 'g'))
ORDER BY digit_count;

-- 3. Show 7-digit numbers (likely missing area code)
SELECT 
    '7-digit numbers (missing area code)' as category,
    phone_number,
    regexp_replace(phone_number, '[^0-9]', '', 'g') as digits_only
FROM found_discs 
WHERE phone_number IS NOT NULL 
  AND phone_number NOT LIKE '+%'
  AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 7
LIMIT 10;

-- 4. Show very short numbers (likely incomplete)
SELECT 
    'Very short numbers (likely incomplete)' as category,
    phone_number,
    length(regexp_replace(phone_number, '[^0-9]', '', 'g')) as digit_count
FROM found_discs 
WHERE phone_number IS NOT NULL 
  AND phone_number NOT LIKE '+%'
  AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) < 7
LIMIT 10;

-- 5. Show very long numbers (likely international or invalid)
SELECT 
    'Very long numbers (international or invalid)' as category,
    phone_number,
    length(regexp_replace(phone_number, '[^0-9]', '', 'g')) as digit_count
FROM found_discs 
WHERE phone_number IS NOT NULL 
  AND phone_number NOT LIKE '+%'
  AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) > 11
LIMIT 10;

-- 6. Summary statistics
SELECT 
    'SUMMARY: Unnormalized phone analysis' as summary,
    COUNT(*) as total_unnormalized,
    COUNT(CASE WHEN length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 7 THEN 1 END) as seven_digit_count,
    COUNT(CASE WHEN length(regexp_replace(phone_number, '[^0-9]', '', 'g')) < 7 THEN 1 END) as too_short_count,
    COUNT(CASE WHEN length(regexp_replace(phone_number, '[^0-9]', '', 'g')) > 11 THEN 1 END) as too_long_count,
    COUNT(CASE WHEN length(regexp_replace(phone_number, '[^0-9]', '', 'g')) BETWEEN 8 AND 11 THEN 1 END) as other_count
FROM found_discs 
WHERE phone_number IS NOT NULL 
  AND phone_number NOT LIKE '+%';
