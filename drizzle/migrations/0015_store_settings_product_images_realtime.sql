CREATE TABLE public.configuracoes_loja (
  id integer PRIMARY KEY DEFAULT 1,
  limite_minimo_pedido integer NOT NULL DEFAULT 10,
  CONSTRAINT configuracoes_loja_singleton CHECK (id = 1)
);
GRANT SELECT ON public.configuracoes_loja TO anon;
GRANT SELECT, INSERT, UPDATE ON public.configuracoes_loja TO authenticated;
GRANT ALL ON public.configuracoes_loja TO service_role;
ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura publica das configuracoes da loja"
ON public.configuracoes_loja FOR SELECT TO anon, authenticated
USING (true);
CREATE POLICY "Admin cria configuracoes da loja"
ON public.configuracoes_loja FOR INSERT TO authenticated
WITH CHECK ((select public.is_active_admin()));
CREATE POLICY "Admin edita configuracoes da loja"
ON public.configuracoes_loja FOR UPDATE TO authenticated
USING ((select public.is_active_admin()))
WITH CHECK ((select public.is_active_admin()));

ALTER TABLE public.products
ADD COLUMN imagens text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.products
ADD CONSTRAINT products_imagens_max_three CHECK (cardinality(imagens) <= 3);

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;