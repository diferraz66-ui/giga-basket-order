ALTER TABLE public.products
  ADD COLUMN max_per_customer integer NOT NULL DEFAULT 0 CHECK (max_per_customer >= 0);

ALTER TABLE public.orders
  ADD COLUMN delivery_method text CHECK (delivery_method IS NULL OR delivery_method IN ('pickup', 'van')),
  ADD COLUMN pickup_name text,
  ADD COLUMN pickup_document text,
  ADD COLUMN delivery_city text,
  ADD COLUMN van_contact text;

CREATE OR REPLACE FUNCTION public.prepare_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product public.products;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_total numeric(10,2) := 0;
  v_id text;
  v_quantity integer;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF NEW.delivery_method NOT IN ('pickup', 'van') THEN
    RAISE EXCEPTION 'Escolha retirada na loja ou despacho via Van';
  END IF;

  IF NEW.delivery_method = 'pickup' THEN
    NEW.pickup_name := trim(COALESCE(NEW.pickup_name, ''));
    NEW.pickup_document := trim(COALESCE(NEW.pickup_document, ''));
    IF length(NEW.pickup_name) < 3 OR length(NEW.pickup_name) > 100
       OR length(NEW.pickup_document) < 3 OR length(NEW.pickup_document) > 30 THEN
      RAISE EXCEPTION 'Informe o nome completo e o CPF ou RG de quem vai retirar';
    END IF;
    NEW.delivery_city := NULL;
    NEW.van_contact := NULL;
  ELSE
    NEW.delivery_city := trim(COALESCE(NEW.delivery_city, ''));
    NEW.van_contact := trim(COALESCE(NEW.van_contact, ''));
    IF length(NEW.delivery_city) < 2 OR length(NEW.delivery_city) > 100
       OR length(NEW.van_contact) < 2 OR length(NEW.van_contact) > 120 THEN
      RAISE EXCEPTION 'Informe a cidade de destino e o contato da Van ou A combinar';
    END IF;
    NEW.pickup_name := NULL;
    NEW.pickup_document := NULL;
  END IF;

  IF jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos um item';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.items)
  LOOP
    v_id := v_item ->> 'id';
    IF v_id IS NULL OR length(v_id) > 120 OR v_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'Lista de produtos invalida';
    END IF;
    v_seen := array_append(v_seen, v_id);
    BEGIN
      v_quantity := (v_item ->> 'quantity')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Quantidade invalida';
    END;
    IF v_quantity < 1 OR v_quantity > 99 OR (v_item ->> 'quantity') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'A quantidade deve ficar entre 1 e 99';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto nao encontrado: %', v_id; END IF;
    IF v_product.status <> 'available' THEN
      RAISE EXCEPTION 'O produto % esta esgotado', v_product.name;
    END IF;
    IF v_product.max_per_customer > 0 AND v_quantity > v_product.max_per_customer THEN
      RAISE EXCEPTION 'Limite maximo de % unidade(s) por cliente para o produto %', v_product.max_per_customer, v_product.name;
    END IF;

    v_items := v_items || jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'price', v_product.price,
      'quantity', v_quantity,
      'subtotal', round(v_product.price * v_quantity, 2)
    );
    v_total := v_total + (v_product.price * v_quantity);
  END LOOP;

  NEW.total := round(v_total, 2);
  IF NEW.total < 75 THEN
    RAISE EXCEPTION 'O pedido minimo para compras online e R$ 75,00';
  END IF;
  NEW.items := v_items;
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_prepare_new
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prepare_new_order();

CREATE OR REPLACE FUNCTION public.update_order_items(p_order_id uuid, p_items jsonb)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders;
  v_product public.products;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_total numeric(10,2) := 0;
  v_id text;
  v_quantity integer;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid() AND active = true
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
  ) THEN
    RAISE EXCEPTION 'Apenas a equipe ativa pode editar pedidos';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado'; END IF;
  IF v_order.status NOT IN ('received', 'in_progress', 'awaiting_pix') THEN
    RAISE EXCEPTION 'Pedidos finalizados nao podem ser editados';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa ter pelo menos um item';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_id := v_item ->> 'id';
    IF v_id IS NULL OR length(v_id) > 120 OR v_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'Lista de produtos invalida';
    END IF;
    v_seen := array_append(v_seen, v_id);
    BEGIN
      v_quantity := (v_item ->> 'quantity')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Quantidade invalida';
    END;
    IF v_quantity < 1 OR v_quantity > 99 OR (v_item ->> 'quantity') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'A quantidade deve ficar entre 1 e 99';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto nao encontrado: %', v_id; END IF;
    IF v_product.status <> 'available' AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_order.items) old_item
      WHERE old_item ->> 'id' = v_id
    ) THEN
      RAISE EXCEPTION 'O produto % esta esgotado', v_product.name;
    END IF;
    IF v_product.max_per_customer > 0 AND v_quantity > v_product.max_per_customer THEN
      RAISE EXCEPTION 'Limite maximo de % unidade(s) por cliente para o produto %', v_product.max_per_customer, v_product.name;
    END IF;

    v_items := v_items || jsonb_build_object(
      'id', v_product.id,
      'name', v_product.name,
      'price', v_product.price,
      'quantity', v_quantity
    );
    v_total := v_total + (v_product.price * v_quantity);
  END LOOP;

  PERFORM set_config('giga.order_mutation', 'items', true);
  UPDATE public.orders
  SET items = v_items,
      total = round(v_total, 2),
      payment_proof_amount = NULL,
      payment_proof_validated_at = NULL,
      payment_proof_validated_total = NULL
  WHERE id = p_order_id
  RETURNING * INTO v_order;
  RETURN v_order;
END;
$$;
REVOKE ALL ON FUNCTION public.update_order_items(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_items(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_name text;
  mutation text := current_setting('giga.order_mutation', true);
BEGIN
  IF OLD.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Um pedido finalizado nao pode ser alterado';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_whatsapp IS DISTINCT FROM OLD.customer_whatsapp
     OR NEW.delivery_method IS DISTINCT FROM OLD.delivery_method
     OR NEW.pickup_name IS DISTINCT FROM OLD.pickup_name
     OR NEW.pickup_document IS DISTINCT FROM OLD.pickup_document
     OR NEW.delivery_city IS DISTINCT FROM OLD.delivery_city
     OR NEW.van_contact IS DISTINCT FROM OLD.van_contact
     OR NEW.order_number IS DISTINCT FROM OLD.order_number THEN
    RAISE EXCEPTION 'Os dados do cliente, recebimento e pedido nao podem ser alterados';
  END IF;

  IF (NEW.items IS DISTINCT FROM OLD.items OR NEW.total IS DISTINCT FROM OLD.total)
     AND mutation IS DISTINCT FROM 'items' THEN
    RAISE EXCEPTION 'Use a edicao de itens para alterar produtos e valores';
  END IF;

  IF (NEW.payment_proof_path IS DISTINCT FROM OLD.payment_proof_path
     OR NEW.payment_proof_name IS DISTINCT FROM OLD.payment_proof_name
     OR NEW.payment_proof_type IS DISTINCT FROM OLD.payment_proof_type
     OR NEW.payment_proof_amount IS DISTINCT FROM OLD.payment_proof_amount
     OR NEW.payment_proof_validated_at IS DISTINCT FROM OLD.payment_proof_validated_at
     OR NEW.payment_proof_validated_total IS DISTINCT FROM OLD.payment_proof_validated_total)
     AND auth.uid() IS NOT NULL AND mutation IS DISTINCT FROM 'items' THEN
    RAISE EXCEPTION 'O comprovante precisa ser validado pelo sistema';
  END IF;

  IF (NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
     OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
     OR NEW.cancelled_by_name IS DISTINCT FROM OLD.cancelled_by_name
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at)
     AND mutation IS DISTINCT FROM 'cancel' THEN
    RAISE EXCEPTION 'Os dados de cancelamento nao podem ser alterados';
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF mutation IS DISTINCT FROM 'finalize' THEN
      RAISE EXCEPTION 'Use a finalizacao protegida do pedido';
    END IF;
    IF NEW.payment_proof_path IS NULL OR NEW.payment_proof_validated_at IS NULL
       OR NEW.payment_proof_amount IS DISTINCT FROM NEW.total
       OR NEW.payment_proof_validated_total IS DISTINCT FROM NEW.total THEN
      RAISE EXCEPTION 'Comprovante Pix validado e valor igual ao total sao obrigatorios';
    END IF;
    NEW.payment_method := 'pix';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF mutation IS DISTINCT FROM 'cancel' OR length(trim(NEW.cancellation_reason)) < 3 THEN
      RAISE EXCEPTION 'Informe o motivo do cancelamento';
    END IF;
  END IF;

  IF NEW.status IN ('in_progress', 'awaiting_pix') AND OLD.status = 'received' THEN
    SELECT full_name INTO staff_name FROM public.team_members WHERE user_id = auth.uid() AND active = true;
    IF staff_name IS NULL THEN RAISE EXCEPTION 'Vendedor responsavel nao encontrado'; END IF;
    NEW.seller_id := auth.uid();
    NEW.seller_name := staff_name;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;