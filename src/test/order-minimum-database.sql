-- Read-only regression tests against the installed order trigger function.
-- Evaluate its actual minimum predicate with concrete quantities and prices.
WITH installed AS (
  SELECT pg_get_functiondef('public.prepare_new_order()'::regprocedure) AS definition
), predicate AS (
  SELECT definition,
    substring(definition FROM 'IF (v_total_quantity[^\n]+) THEN') AS expression
  FROM installed
), samples(label, quantities, minimum, total, rejected) AS (
  VALUES
    ('9 units fail minimum 10 even above R$75', ARRAY[4,5], 10, 90::numeric, true),
    ('10 units pass minimum 10 even below R$75', ARRAY[4,6], 10, 50::numeric, false),
    ('6 units pass configured minimum 6', ARRAY[2,4], 6, 30::numeric, false),
    ('10 units fail configured minimum 12', ARRAY[4,6], 12, 100::numeric, true)
), evaluated AS (
  SELECT label, rejected,
    (xpath('/table/row/rejected/text()', query_to_xml(
      format('SELECT (%s) AS rejected FROM (SELECT %s::bigint AS v_total_quantity, %s::integer AS v_minimum_quantity, %s::numeric AS total) sample',
        expression, (SELECT sum(q) FROM unnest(quantities) q), minimum, total),
      false, false, ''
    )))[1]::text::boolean AS actual
  FROM samples CROSS JOIN predicate
), rules AS (
  SELECT label AS rule, COALESCE(actual = rejected, false) AS passed FROM evaluated
  UNION ALL
  SELECT 'trigger accumulates quantities and reads singleton store minimum',
    definition LIKE '%v_total_quantity := v_total_quantity + v_quantity;%'
    AND definition LIKE '%SELECT limite_minimo_pedido FROM public.configuracoes_loja WHERE id = 1%'
    AND definition NOT LIKE '%IF NEW.total < 75 THEN%'
  FROM installed
  UNION ALL
  SELECT 'products replica identity is FULL',
    relreplident = 'f' FROM pg_class WHERE oid = 'public.products'::regclass
)
SELECT rule, 1 / CASE WHEN passed THEN 1 ELSE 0 END AS assertion FROM rules;