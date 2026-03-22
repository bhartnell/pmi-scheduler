-- Security Definer functions for Supabase RLS policies
-- These run with elevated privileges to check user roles/departments
-- Must be run in Supabase SQL Editor

-- 1. is_superadmin
DROP FUNCTION IF EXISTS public.is_superadmin() CASCADE;
CREATE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$ BEGIN
  RETURN EXISTS (
    SELECT 1 FROM lab_users
    WHERE email = auth.jwt() ->> 'email'
    AND role = 'superadmin' AND status = 'active'
  );
END; $$;

-- 2. has_pmi_ops_role
DROP FUNCTION IF EXISTS public.has_pmi_ops_role(TEXT) CASCADE;
CREATE FUNCTION public.has_pmi_ops_role(role_name TEXT)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$ BEGIN
  IF is_superadmin() THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN lab_users lu ON lu.id = ur.user_id
    WHERE lu.email = auth.jwt() ->> 'email'
    AND lu.status = 'active' AND ur.role = role_name
  );
END; $$;

-- 3. is_access_admin
DROP FUNCTION IF EXISTS public.is_access_admin() CASCADE;
CREATE FUNCTION public.is_access_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$ BEGIN RETURN has_pmi_ops_role('access_admin'); END; $$;

-- 4. is_inventory_admin
DROP FUNCTION IF EXISTS public.is_inventory_admin() CASCADE;
CREATE FUNCTION public.is_inventory_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$ BEGIN RETURN has_pmi_ops_role('inventory_admin'); END; $$;

-- 5. is_print_operator
DROP FUNCTION IF EXISTS public.is_print_operator() CASCADE;
CREATE FUNCTION public.is_print_operator()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$ BEGIN RETURN has_pmi_ops_role('operator'); END; $$;

-- 6. has_ops_access
DROP FUNCTION IF EXISTS public.has_ops_access() CASCADE;
CREATE FUNCTION public.has_ops_access()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$ BEGIN
  RETURN EXISTS (
    SELECT 1 FROM lab_users lu
    JOIN user_departments ud ON ud.user_id = lu.id
    JOIN departments d ON d.id = ud.department_id
    WHERE lu.email = auth.jwt() ->> 'email'
    AND lu.status = 'active' AND d.abbreviation = 'OPS'
  );
END; $$;

-- Force PostgREST schema reload
SELECT pg_notify('pgrst', 'reload schema');
