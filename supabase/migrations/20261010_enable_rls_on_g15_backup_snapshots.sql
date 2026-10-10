-- Enable RLS (deny-by-default, no policies) on six G15 2026-10-06 backup
-- snapshots that were exposed via the public API with RLS off
-- (advisor rls_disabled_in_public). Pre-check: zero references in repo code.
-- Idempotent; data untouched.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
      AND c.relname LIKE '\_backup\_%g15\_20261006'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;
-- ROLLBACK: ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY; (per table)
