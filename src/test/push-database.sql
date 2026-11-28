-- Read-only assertions: return 1 on success, raise division-by-zero otherwise.
SELECT 1 / CASE WHEN to_regprocedure('public.save_push_subscription(text,text,text,text)') IS NOT NULL THEN 1 ELSE 0 END AS rpc_exists;
SELECT 1 / CASE WHEN prosecdef THEN 1 ELSE 0 END AS security_definer
FROM pg_proc WHERE oid = to_regprocedure('public.save_push_subscription(text,text,text,text)');
SELECT 1 / CASE WHEN has_function_privilege('anon', 'public.save_push_subscription(text,text,text,text)', 'EXECUTE') THEN 1 ELSE 0 END AS anonymous_execute;
SELECT 1 / CASE WHEN has_function_privilege('authenticated', 'public.save_push_subscription(text,text,text,text)', 'EXECUTE') THEN 1 ELSE 0 END AS authenticated_execute;
SELECT 1 / CASE WHEN position('ON CONFLICT (endpoint) DO UPDATE' IN pg_get_functiondef(oid)) > 0 THEN 1 ELSE 0 END AS updates_existing_endpoint
FROM pg_proc WHERE oid = to_regprocedure('public.save_push_subscription(text,text,text,text)');
SELECT 1 / CASE WHEN has_table_privilege('service_role', 'public.push_subscriptions', 'DELETE') THEN 1 ELSE 0 END AS server_removes_expired;