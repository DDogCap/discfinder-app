-- Stop guests reading owner contact info directly from tables/views.
-- public_found_discs (owner-privileged view, masks contact fields for guests) stays the public read path.

-- 1. found_discs: direct reads only for signed-in, non-guest users (matches public_found_discs' unmasking rule).
--    Admins keep full access via "Admins can manage all found discs".
DROP POLICY IF EXISTS "Anyone can view found discs basic info" ON found_discs;
CREATE POLICY "Signed-in users can view active found discs" ON found_discs
  FOR SELECT TO authenticated
  USING (status = 'active' AND get_user_role() <> 'guest');

-- 2. admin_found_discs: ran with owner privileges and was granted to anon, exposing every disc,
--    finder emails and contact history. Run it as the caller so found_discs/contact_attempts RLS applies.
ALTER VIEW admin_found_discs SET (security_invoker = true);
REVOKE ALL ON admin_found_discs FROM anon;

-- 3. profiles: the "authenticated" read policy applied to everyone, including signed-out visitors.
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON profiles;
CREATE POLICY "Allow authenticated users to read profiles" ON profiles
  FOR SELECT TO authenticated
  USING (true);
