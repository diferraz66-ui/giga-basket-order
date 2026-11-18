CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Equipe ve os proprios papeis e admin ve todos"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.team_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  full_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve o proprio cadastro e admin ve a equipe"
ON public.team_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 7.50 CHECK (price >= 0),
  category text NOT NULL CHECK (category IN ('cozinha','casa-decoracao','organizacao','beleza','papelaria','brinquedos','ferramentas','utilidades','acessorios')),
  dimensions text NOT NULL DEFAULT '',
  image_key text,
  image_url text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','out_of_stock')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes e equipe veem produtos"
ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin cadastra produtos"
ON public.products FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin edita produtos"
ON public.products FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin exclui produtos"
ON public.products FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.products (id, name, description, price, category, dimensions, image_key, tags, status)
SELECT * FROM (VALUES
  ('kit-potes-hermeticos', 'Kit 5 Potes Herméticos', 'Tampas com vedação, vão ao micro-ondas e à geladeira.', 7.50::numeric, 'cozinha', '5 peças: 250 ml, 400 ml, 650 ml, 1 L e 1,5 L', 'potes', ARRAY['oferta','mais-vendido'], 'available'),
  ('luminaria-led-mesa', 'Luminária LED de Mesa', 'Luz quente com toque, cabeça giratória e cabo USB.', 7.50::numeric, 'casa-decoracao', 'Altura aproximada de 35 cm; cabo USB de 1 m', 'luminaria', ARRAY['destaque'], 'available'),
  ('organizador-acrilico', 'Organizador Acrílico 4 Gavetas', 'Ideal para maquiagem, bijuterias e escritório.', 7.50::numeric, 'organizacao', 'Aproximadamente 24 × 15 × 18 cm', 'organizador', ARRAY['oferta','destaque'], 'available'),
  ('kit-pinceis-maquiagem', 'Kit 9 Pincéis de Maquiagem', 'Cerdas macias com porta-pincéis incluso.', 7.50::numeric, 'beleza', '9 pincéis com cabos de aproximadamente 12 a 15 cm', 'pinceis', ARRAY['mais-vendido'], 'available'),
  ('canetas-gel-caderno', 'Kit 12 Canetas Gel + Caderno', 'Cores vibrantes, ponta 0.7 mm e caderno espiral.', 7.50::numeric, 'papelaria', 'Canetas ponta 0,7 mm; caderno tamanho A5', 'canetas', ARRAY['mais-vendido','destaque'], 'available'),
  ('cubo-magico', 'Cubo Mágico 3x3', 'Giro suave e cores firmes. Diversão para todas as idades.', 7.50::numeric, 'brinquedos', 'Aproximadamente 5,6 × 5,6 × 5,6 cm', 'cubo', ARRAY['oferta'], 'available'),
  ('jogo-chaves-precisao', 'Jogo de Chaves de Precisão 45 pçs', 'Para celulares, óculos, eletrônicos e pequenos reparos.', 7.50::numeric, 'ferramentas', 'Estojo de aproximadamente 20 × 11 × 5 cm; 45 peças', 'chaves', ARRAY['novidade'], 'available'),
  ('fone-bluetooth', 'Fone Bluetooth com Estojo', 'Sem fio, estojo carregador e microfone embutido.', 7.50::numeric, 'acessorios', 'Estojo de aproximadamente 6 × 5 × 2,5 cm', 'fone', ARRAY['novidade','oferta','destaque'], 'available')
) AS seed (id, name, description, price, category, dimensions, image_key, tags, status);

ALTER TABLE public.orders
  ADD COLUMN status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_progress','awaiting_pix','completed','cancelled')),
  ADD COLUMN payment_method text NOT NULL DEFAULT 'pix' CHECK (payment_method = 'pix'),
  ADD COLUMN seller_id uuid,
  ADD COLUMN seller_name text,
  ADD COLUMN confirmed_by uuid,
  ADD COLUMN confirmed_by_name text,
  ADD COLUMN paid_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX orders_status_created_idx ON public.orders (status, created_at DESC);
CREATE INDEX orders_user_status_idx ON public.orders (user_id, status);

CREATE POLICY "Equipe ve todos os pedidos"
ON public.orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Equipe atualiza atendimento"
ON public.orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE POLICY "Admin ve todos os clientes"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opt_in boolean := COALESCE((NEW.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false);
BEGIN
  IF COALESCE(NEW.raw_user_meta_data ->> 'staff', 'false') = 'true' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.profiles (id, full_name, whatsapp, marketing_opt_in, marketing_opt_in_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Cliente'),
    COALESCE(NEW.raw_user_meta_data ->> 'whatsapp', split_part(NEW.email, '@', 1)),
    opt_in,
    CASE WHEN opt_in THEN now() ELSE NULL END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_name text;
BEGIN
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
  ELSIF NEW.status <> 'completed' AND OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Uma venda concluida nao pode ser reaberta';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente Admin/Financeiro pode cancelar o pedido';
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

CREATE TRIGGER orders_guard_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_update();

CREATE OR REPLACE FUNCTION public.touch_product()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER products_touch_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_product();

CREATE POLICY "Admin envia fotos de produtos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza fotos de produtos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin exclui fotos de produtos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));