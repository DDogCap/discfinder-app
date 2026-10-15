-- Limit who can add/change found discs, and close remaining open SECURITY DEFINER functions.

-- 1. Only admins add found discs for now ("Admins can manage all found discs" covers them).
--    Long term: let finders add discs they found.
DROP POLICY IF EXISTS "Authenticated users can insert found discs" ON found_discs;

-- 2. Return status: was callable by anyone (even signed out) for any disc
CREATE OR REPLACE FUNCTION public.update_disc_return_status(disc_id uuid, new_status return_status, notes text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT is_trusted_caller() THEN
        RAISE EXCEPTION 'Only admins can change return status' USING ERRCODE = '42501';
    END IF;

    UPDATE found_discs
    SET
        return_status = new_status,
        returned_at = CASE WHEN new_status != 'Found' THEN NOW() ELSE NULL END,
        returned_notes = notes,
        updated_at = NOW()
    WHERE id = disc_id;
END;
$$;

-- 3. Server-only functions (import scripts use the service-role key; the app doesn't call these)
REVOKE ALL ON FUNCTION public.import_legacy_found_disc(text, text, text, text, text, text, text, text, text, integer, text, text, date, timestamp with time zone, text, timestamp with time zone, text, return_status, text, text[], text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_legacy_found_disc_with_rack_id(text, integer, text, text, text, text, text, text, text, text, integer, text, text, date, timestamp with time zone, text, timestamp with time zone, text, return_status, text, text[], text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_orphaned_disc_images() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_default_source(uuid) FROM PUBLIC, anon, authenticated;

-- 4. get_user_role: your own role only (policies call it with the default, auth.uid());
--    looking up someone else's role needs an admin/trusted caller
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS user_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    user_role_result user_role;
BEGIN
    IF user_id IS NULL OR (user_id IS DISTINCT FROM auth.uid() AND NOT is_trusted_caller()) THEN
        RETURN 'guest'::user_role;
    END IF;

    SELECT role INTO user_role_result
    FROM profiles
    WHERE id = user_id;

    RETURN COALESCE(user_role_result, 'guest'::user_role);
END;
$$;
