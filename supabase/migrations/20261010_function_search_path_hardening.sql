-- Security Tier 3 item 1: pin search_path on public functions flagged
-- function_search_path_mutable (38 at 2026-10-10).
-- Uses 'public, pg_temp' (NOT '') so unqualified public names in function
-- bodies keep resolving exactly as before; no behaviour change, only
-- removes the mutable-path hijack surface. Verified: none of the 38 bodies
-- reference extension-schema objects. Idempotent: skips functions that
-- already have a search_path config and extension-owned functions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.fn);
  END LOOP;
END $$;

-- ROLLBACK: for each affected function run
--   ALTER FUNCTION <sig> RESET search_path;
-- (affected set = public functions with proconfig exactly {search_path=public, pg_temp}
--  created by this migration; list is the 38 in the 2026-10-10 advisors read.)
