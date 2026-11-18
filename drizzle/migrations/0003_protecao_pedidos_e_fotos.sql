CREATE POLICY "Clientes e equipe veem fotos dos produtos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'product-images');

CREATE OR REPLACE FUNCTION public.guard_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_name text;
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_whatsapp IS DISTINCT FROM OLD.customer_whatsapp
     OR NEW.items IS DISTINCT FROM OLD.items
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.order_number IS DISTINCT FROM OLD.order_number THEN
    RAISE EXCEPTION 'Os dados e valores do pedido nao podem ser alterados';
  END IF;

  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Uma venda concluida nao pode ser alterada';
  END IF;

  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Somente Admin/Financeiro pode confirmar o pagamento';
    END IF;
    IF NEW.seller_id IS NULL OR NEW.seller_name IS NULL THEN
      RAISE EXCEPTION 'O pedido precisa ter um vendedor responsavel';
    END IF;
    SELECT full_name INTO staff_name FROM public.team_members WHERE user_id = auth.uid() AND active = true;
    IF staff_name IS NULL THEN
      RAISE EXCEPTION 'Responsavel pelo pagamento nao encontrado';
    END IF;
    NEW.confirmed_by := auth.uid();
    NEW.confirmed_by_name := staff_name;
    NEW.paid_at := now();
    NEW.payment_method := 'pix';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente Admin/Financeiro pode cancelar o pedido';
  END IF;

  IF public.has_role(auth.uid(), 'vendedor')
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('in_progress', 'awaiting_pix') THEN
    RAISE EXCEPTION 'Vendedor so pode iniciar atendimento e aguardar Pix';
  END IF;

  IF NEW.status IN ('in_progress', 'awaiting_pix') AND OLD.status = 'received' THEN
    SELECT full_name INTO staff_name FROM public.team_members WHERE user_id = auth.uid() AND active = true;
    IF staff_name IS NULL THEN
      RAISE EXCEPTION 'Vendedor responsavel nao encontrado';
    END IF;
    NEW.seller_id := auth.uid();
    NEW.seller_name := staff_name;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;