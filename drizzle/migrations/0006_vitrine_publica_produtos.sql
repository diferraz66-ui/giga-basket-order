GRANT SELECT ON public.products TO anon;

CREATE POLICY "Visitantes veem produtos"
ON public.products FOR SELECT TO anon
USING (true);