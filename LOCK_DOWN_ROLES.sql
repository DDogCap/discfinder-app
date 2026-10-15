-- Close admin-escalation paths. Before this, anyone (even signed out) could become admin via
-- admin_add_admin_user / import_legacy_profile / create_user_profile, and any signed-in user could
-- UPDATE their own profiles.role.
--
-- Trusted callers keep working: admins, the service-role key (import scripts), the SQL editor,
-- and SECURITY DEFINER functions (they run as their owner, not as anon/authenticated).

-- Helpers ---------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_profile_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Request came from an admin, the service-role key, or a direct DB session (SQL editor/migrations)
CREATE OR REPLACE FUNCTION public.is_trusted_caller()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT session_user <> 'authenticator'
      OR coalesce(auth.role(), '') = 'service_role'
      OR is_profile_admin();
$$;

-- Role a pending (staged) profile was given for the signed-in user's own email
CREATE OR REPLACE FUNCTION public.staged_role_for_current_user()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM imported_profiles_staging
  WHERE lower(email) = lower(auth.jwt() ->> 'email')
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;
$$;

-- profiles.role can only be set by trusted callers -----------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Direct API requests run as anon/authenticated; service role and DEFINER functions don't
  IF current_user NOT IN ('anon', 'authenticated') OR is_profile_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Self-signup: ignore the client's role; use the staged role for this email, else 'user'
    NEW.role := coalesce(staged_role_for_current_user(), 'user');
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only admins can change roles' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_role ON profiles;
CREATE TRIGGER enforce_profile_role
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_profile_role();

-- Anyone (incl. signed out) could insert profile rows for any id; keep only "own profile" inserts
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;

-- Privileged functions: wrap with a caller check ------------------------------------------------

ALTER FUNCTION public.import_legacy_profile(text, text, user_role, text, integer, text, text, text, text, text)
  RENAME TO import_legacy_profile_unchecked;
REVOKE ALL ON FUNCTION public.import_legacy_profile_unchecked(text, text, user_role, text, integer, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.import_legacy_profile(
  p_email text, p_full_name text DEFAULT ''::text, p_role user_role DEFAULT 'user'::user_role,
  p_legacy_row_id text DEFAULT NULL, p_pdga_number integer DEFAULT NULL, p_facebook_profile text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL, p_sms_number text DEFAULT NULL, p_phone_number text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_trusted_caller() THEN
    RAISE EXCEPTION 'Only admins can import profiles' USING ERRCODE = '42501';
  END IF;
  RETURN import_legacy_profile_unchecked(p_email, p_full_name, p_role, p_legacy_row_id, p_pdga_number,
    p_facebook_profile, p_instagram_handle, p_sms_number, p_phone_number, p_avatar_url);
END;
$$;

ALTER FUNCTION public.admin_add_admin_user(text, text) RENAME TO admin_add_admin_user_unchecked;
REVOKE ALL ON FUNCTION public.admin_add_admin_user_unchecked(text, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.admin_add_admin_user(p_email text, p_full_name text DEFAULT ''::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_trusted_caller() THEN
    RAISE EXCEPTION 'Only admins can add admins' USING ERRCODE = '42501';
  END IF;
  PERFORM admin_add_admin_user_unchecked(p_email, p_full_name);
END;
$$;

-- Unused by the app; inserted profiles with any role for any id
REVOKE ALL ON FUNCTION public.create_user_profile(uuid, text, text, user_role) FROM PUBLIC, anon, authenticated;

-- Owner-privileged views that exposed staged profiles / turn-in data to everyone ----------------

ALTER VIEW imported_profiles SET (security_invoker = true);
REVOKE ALL ON imported_profiles FROM anon;
DROP POLICY IF EXISTS "Admins can read staged profiles" ON imported_profiles_staging;
CREATE POLICY "Admins can read staged profiles" ON imported_profiles_staging
  FOR SELECT TO authenticated
  USING (is_profile_admin());

ALTER VIEW admin_bulk_turnins SET (security_invoker = true);
REVOKE ALL ON admin_bulk_turnins FROM anon;
