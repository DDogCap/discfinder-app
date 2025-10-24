-- Paginated Phone digits search RPC for guests/authenticated
-- Replaces the previous function with offset/limit support

DROP FUNCTION IF EXISTS public.search_disc_ids_by_phone_digits(p_digits text);

CREATE OR REPLACE FUNCTION public.search_disc_ids_by_phone_digits(
  p_digits text,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 1000
)
RETURNS TABLE(id uuid) AS $$
BEGIN
  IF p_digits IS NULL OR length(regexp_replace(p_digits, '[^0-9]', '', 'g')) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT fd.id
  FROM found_discs fd
  WHERE fd.status = 'active'
    AND regexp_replace(coalesce(fd.phone_number, ''), '[^0-9]', '', 'g')
        LIKE '%' || regexp_replace(p_digits, '[^0-9]', '', 'g') || '%'
  OFFSET p_offset
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.search_disc_ids_by_phone_digits(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_disc_ids_by_phone_digits(text, int, int) TO anon, authenticated;

