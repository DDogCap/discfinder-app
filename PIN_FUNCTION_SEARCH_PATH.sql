-- Supabase advisor 0011 (function_search_path_mutable): pin search_path on this app's functions.
-- 'public' rather than '' because the bodies use unqualified table names.
-- v2 functions (tg_v2_set_updated_at, match_molds) belong to the dzdiscfinder-v2 repo and are left alone.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_user_default_source', 'calculate_match_score', 'find_potential_matches', 'auto_create_matches',
        'update_sources_updated_at', 'get_user_default_source', 'update_contact_attempts_updated_at',
        'get_next_rack_id', 'verify_bulk_turnin', 'ensure_rack_id', 'create_bulk_turnin',
        'create_bulk_turnin_payment', 'confirm_payment_receipt', 'get_rakerdiver_turnins',
        'import_legacy_profile_unchecked', 'admin_add_admin_user_unchecked', 'create_user_profile',
        'mask_phone', 'mask_contact_text', 'import_legacy_found_disc', 'import_legacy_found_disc_with_rack_id',
        'cleanup_orphaned_disc_images'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', f.sig);
  END LOOP;
END $$;
