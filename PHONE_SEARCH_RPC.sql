-- Phone digits search RPC for guests and authenticated users
-- Creates a SECURITY DEFINER function that returns only IDs of found_discs
-- whose phone_number (digits-only) contains the provided digits. This allows
-- guests to get matching IDs without exposing phone numbers.

-- Safety: drop existing function if present
DROP FUNCTION IF EXISTS public.search_disc_ids_by_phone_digits(p_digits text);

CREATE OR REPLACE FUNCTION public.search_disc_ids_by_phone_digits(p_digits text)
RETURNS TABLE(id uuid) AS $$
BEGIN
  -- If no digits provided, return no rows to avoid full scans
  IF p_digits IS NULL OR length(regexp_replace(p_digits, '[^0-9]', '', 'g')) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT fd.id
  FROM found_discs fd
  WHERE fd.status = 'active'
    AND regexp_replace(coalesce(fd.phone_number, ''), '[^0-9]', '', 'g')
        LIKE '%' || regexp_replace(p_digits, '[^0-9]', '', 'g') || '%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Permissions: allow both anon and authenticated to execute
REVOKE ALL ON FUNCTION public.search_disc_ids_by_phone_digits(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_disc_ids_by_phone_digits(text) TO anon, authenticated;

-- Optional index (run separately if needed for performance):
-- CREATE INDEX IF NOT EXISTS idx_found_discs_phone_digits
--   ON found_discs ((regexp_replace(coalesce(phone_number, ''), '[^0-9]', '', 'g')));

