-- Owner contact info is only ever returned in full to admins and to the disc's finder.
-- Everyone else (guests and signed-in users alike) gets: name on disc in full, phone as last 4,
-- no email/PDGA, digits masked in descriptions. Owners can still find their disc by name,
-- last 4+ phone digits, or exact email/PDGA via ID-only search functions.

-- Phone shown as •••-•••-1234 (NULL if fewer than 4 digits)
CREATE OR REPLACE FUNCTION public.mask_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) >= 4
      THEN '•••-•••-' || right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4)
  END;
$$;

-- Free text (name, stamp, description) sometimes holds a phone number or email: mask emails and
-- runs of 3+ digits, leaving real names readable
CREATE OR REPLACE FUNCTION public.mask_contact_text(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(p_text, '\S+@\S+', '•••', 'g'), '\d{3,}', '•••', 'g');
$$;

-- Same columns/order as before; runs as owner so it can read found_discs for everyone
CREATE OR REPLACE VIEW public_found_discs AS
SELECT
    fd.id,
    fd.rack_id,
    fd.brand,
    fd.mold,
    fd.disc_type,
    fd.color,
    fd.condition,
    fd.location_found,
    fd.found_date,
    fd.created_at,
    fd.image_urls,
    fd.return_status,
    fd.returned_at,
    s.name AS source_name,
    fd.weight,
    fd.plastic_type,
    CASE WHEN a.full_access THEN fd.stamp_text ELSE mask_contact_text(fd.stamp_text) END AS stamp_text,
    CASE WHEN a.full_access THEN fd.phone_number ELSE mask_phone(fd.phone_number) END AS phone_number,
    CASE WHEN a.full_access THEN fd.name_on_disc ELSE mask_contact_text(fd.name_on_disc) END AS name_on_disc,
    CASE WHEN a.full_access THEN fd.owner_email END AS owner_email,
    CASE WHEN a.full_access THEN fd.owner_pdga_number END AS owner_pdga_number,
    CASE WHEN a.full_access THEN fd.description ELSE mask_contact_text(fd.description) END AS description,
    CASE WHEN a.full_access THEN fd.finder_id END AS finder_id,
    CASE WHEN a.full_access THEN fd.returned_notes END AS returned_notes
FROM found_discs fd
LEFT JOIN sources s ON fd.source_id = s.id
CROSS JOIN LATERAL (
    SELECT (is_profile_admin() OR (fd.finder_id IS NOT NULL AND fd.finder_id = auth.uid())) AS full_access
) a
WHERE fd.status = 'active'
  AND (fd.return_status IS NULL OR fd.return_status IN ('Found', 'For Sale Used'));

GRANT SELECT ON public_found_discs TO anon, authenticated;

-- Phone search: at least 4 digits (e.g. last four), returns IDs only. Also checks name/stamp,
-- where some phone numbers were entered (masked in the view, so text search can't find them)
CREATE OR REPLACE FUNCTION public.search_disc_ids_by_phone_digits(p_digits text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000)
RETURNS TABLE(id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_digits, ''), '[^0-9]', '', 'g');
BEGIN
  IF length(v_digits) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT fd.id
  FROM found_discs fd
  WHERE fd.status = 'active'
    AND (
      regexp_replace(coalesce(fd.phone_number, ''), '[^0-9]', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(fd.name_on_disc, ''), '[^0-9]', '', 'g') LIKE '%' || v_digits || '%'
      OR regexp_replace(coalesce(fd.stamp_text, ''), '[^0-9]', '', 'g') LIKE '%' || v_digits || '%'
    )
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;

-- Owner search: exact email or exact PDGA number, returns IDs only (no partial matching to browse)
CREATE OR REPLACE FUNCTION public.search_disc_ids_by_owner(p_term text)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT fd.id
  FROM found_discs fd
  WHERE fd.status = 'active'
    AND length(trim(coalesce(p_term, ''))) > 0
    AND (
      lower(fd.owner_email) = lower(trim(p_term))
      OR (trim(p_term) ~ '^\d{1,9}$' AND fd.owner_pdga_number = trim(p_term)::integer)
    )
  LIMIT 1000;
$$;

GRANT EXECUTE ON FUNCTION public.search_disc_ids_by_owner(text) TO anon, authenticated;

-- found_discs direct reads: admins (existing policy) and the disc's finder only
DROP POLICY IF EXISTS "Signed-in users can view active found discs" ON found_discs;
DROP POLICY IF EXISTS "Finders can view own found discs" ON found_discs;
CREATE POLICY "Finders can view own found discs" ON found_discs
  FOR SELECT TO authenticated
  USING (finder_id = auth.uid());

-- profiles: own row ("Users can view own profile") plus admins see all
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (is_profile_admin());
