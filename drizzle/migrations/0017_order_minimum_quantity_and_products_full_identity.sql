DO $migration$
DECLARE
  v_definition text := pg_get_functiondef('public.prepare_new_order()'::regprocedure);
BEGIN
  IF position('IF NEW.total < 75 THEN' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'A função de pedidos mudou; revisar antes de substituir a regra de mínimo';
  END IF;
  v_definition := replace(v_definition,
    '  v_total numeric(10,2) := 0;',
    E'  v_total numeric(10,2) := 0;\n  v_total_quantity bigint := 0;\n  v_minimum_quantity integer;');
  v_definition := replace(v_definition,
    '    v_total := v_total + (v_product.price * v_quantity);',
    E'    v_total := v_total + (v_product.price * v_quantity);\n    v_total_quantity := v_total_quantity + v_quantity;');
  v_definition := replace(v_definition,
    E'  IF NEW.total < 75 THEN\n    RAISE EXCEPTION ''O pedido minimo para compras online e R$ 75,00'';\n  END IF;',
    E'  SELECT COALESCE(\n    (SELECT limite_minimo_pedido FROM public.configuracoes_loja WHERE id = 1),\n    10\n  ) INTO v_minimum_quantity;\n  IF v_total_quantity < v_minimum_quantity THEN\n    RAISE EXCEPTION ''O pedido minimo para compras online e % unidade(s)'', v_minimum_quantity;\n  END IF;');
  IF position('IF NEW.total < 75 THEN' IN v_definition) > 0
    OR position('IF v_total_quantity < v_minimum_quantity THEN' IN v_definition) = 0
    OR position('v_total_quantity := v_total_quantity + v_quantity;' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Nao foi possivel substituir integralmente a regra de minimo';
  END IF;
  EXECUTE v_definition;
END;
$migration$;

ALTER TABLE public.products REPLICA IDENTITY FULL;