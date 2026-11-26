-- Read-only regression tests: division by zero fails a violated rule.
-- Execute against the project's database after applying the schema migration.
WITH minimum_default AS (
  SELECT pg_get_expr(d.adbin, d.adrelid) AS expression
  FROM pg_attrdef d
  JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  WHERE d.adrelid = 'public.configuracoes_loja'::regclass
    AND a.attname = 'limite_minimo_pedido'
), image_constraint AS (
  SELECT pg_get_expr(conbin, conrelid) AS expression
  FROM pg_constraint
  WHERE conrelid = 'public.products'::regclass
    AND conname = 'products_imagens_max_three' AND convalidated
), image_checks AS (
  SELECT n, (xpath('/table/row/allowed/text()', query_to_xml(
    format('SELECT (%s) AS allowed FROM (SELECT array_fill(''photo''::text, ARRAY[%s]) AS imagens) sample', expression, n),
    false, false, ''
  )))[1]::text::boolean AS allowed
  FROM image_constraint CROSS JOIN (VALUES (0), (3), (4)) sizes(n)
), rules AS (
  SELECT 'minimum defaults to 10' AS rule,
    COALESCE((SELECT (xpath('/table/row/valid/text()', query_to_xml(
      format('SELECT (%s) = 10 AS valid', expression), false, false, ''
    )))[1]::text::boolean FROM minimum_default), false) AS passed
  UNION ALL
  SELECT 'gallery accepts empty and three photos, rejects four',
    (SELECT count(*) = 3 AND bool_and(allowed = (n <= 3)) FROM image_checks)
  UNION ALL
  SELECT 'settings enforce public read and active admin writes',
    has_table_privilege('anon', 'public.configuracoes_loja', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.configuracoes_loja', 'UPDATE')
    AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.configuracoes_loja'::regclass)
    AND (SELECT count(*) = 3 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'configuracoes_loja'
      AND ((cmd = 'SELECT' AND qual = 'true' AND roles @> ARRAY['anon', 'authenticated']::name[])
        OR (cmd = 'INSERT' AND roles = ARRAY['authenticated']::name[] AND with_check LIKE '%is_active_admin()%')
        OR (cmd = 'UPDATE' AND roles = ARRAY['authenticated']::name[] AND qual LIKE '%is_active_admin()%' AND with_check LIKE '%is_active_admin()%')))
  UNION ALL
  SELECT 'products realtime enabled with RLS intact',
    EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'products')
    AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.products'::regclass)
)
SELECT rule, 1 / CASE WHEN passed THEN 1 ELSE 0 END AS assertion FROM rules;