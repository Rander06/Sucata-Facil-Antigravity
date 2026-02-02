DO $$
DECLARE
    r RECORD;
    func_name text;
BEGIN
    FOR r IN
        SELECT P.oid, P.proname, pg_get_function_identity_arguments(P.oid) as args
        FROM pg_proc P
        JOIN pg_namespace N ON P.pronamespace = N.oid
        WHERE N.nspname = 'public'
          AND P.proname IN (
            'get_permissions_from_plan_modules',
            'set_admin_permissions_from_plan',
            'map_modules_to_permissions',
            'handle_new_user'
          )
    LOOP
        func_name := quote_ident(r.proname) || '(' || r.args || ')';
        RAISE NOTICE 'Fixing search_path for function: %', func_name;
        EXECUTE 'ALTER FUNCTION public.' || func_name || ' SET search_path = public';
    END LOOP;
END $$;
