-- One-off data fix (2026-10-14): phone numbers / emails entered into name or stamp fields.
-- Each update only applies if the row still holds the exact misplaced value.

-- Phone in stamp -> phone_number
UPDATE found_discs SET phone_number = '+15419414050', stamp_text = NULL, updated_at = now()
WHERE rack_id = 1169 AND stamp_text = '5419414050' AND phone_number IS NULL;

-- Email in stamp -> owner_email
UPDATE found_discs SET owner_email = 'laurarenetrn@yahoo.com', stamp_text = NULL, updated_at = now()
WHERE rack_id = 1797 AND stamp_text = 'Laurarenetrn@yahoo.com' AND owner_email IS NULL;

-- Phone in name -> phone_number
UPDATE found_discs SET phone_number = '+18164190095', name_on_disc = NULL, updated_at = now()
WHERE rack_id = 4894 AND name_on_disc = '816-419-0095' AND phone_number IS NULL;

UPDATE found_discs SET phone_number = '+19132768438', name_on_disc = NULL, updated_at = now()
WHERE rack_id = 6268 AND name_on_disc = '9132768438' AND phone_number IS NULL;

UPDATE found_discs SET phone_number = '+16365159833', name_on_disc = NULL, updated_at = now()
WHERE rack_id = 7287 AND name_on_disc = '6365159833' AND phone_number IS NULL;

UPDATE found_discs SET phone_number = '+14172831032', name_on_disc = NULL, updated_at = now()
WHERE rack_id = 8861 AND name_on_disc = '4172831032' AND phone_number IS NULL;

-- Name held a copy of the phone already in phone_number
UPDATE found_discs SET name_on_disc = NULL, updated_at = now()
WHERE rack_id = 4939 AND name_on_disc = '6207575134' AND phone_number = '+16207575134';

UPDATE found_discs SET name_on_disc = NULL, updated_at = now()
WHERE rack_id = 5279 AND name_on_disc = '6025014255' AND phone_number = '+16025014255';
