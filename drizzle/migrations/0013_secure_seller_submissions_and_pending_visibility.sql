ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS pode_cadastrar_produtos boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado', ADD COLUMN IF NOT EXISTS cadastrado_por text;

DROP POLICY IF EXISTS "Visitantes veem produtos" ON public.products;
CREATE POLICY "Visitantes veem produtos" ON public.products FOR SELECT TO anon USING (status_aprovacao = 'aprovado');
DROP POLICY IF EXISTS "Clientes e equipe veem produtos" ON public.products;
CREATE POLICY "Clientes e equipe veem produtos" ON public.products FOR SELECT TO authenticated USING (status_aprovacao = 'aprovado' OR public.is_active_admin() OR cadastrado_por = auth.uid()::text);
DROP POLICY IF EXISTS "Admin cadastra produtos" ON public.products;
CREATE POLICY "Admin cadastra produtos" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
DROP POLICY IF EXISTS "Admin edita produtos" ON public.products;
DROP POLICY IF EXISTS "Admin exclui produtos" ON public.products;
DROP POLICY IF EXISTS "Authorized sellers submit pending products" ON public.products;
CREATE POLICY "Authorized sellers submit pending products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.can_submit_product() AND status_aprovacao = 'pendente' AND cadastrado_por = auth.uid()::text AND price = 7.50 AND status = 'available' AND max_per_customer = 0 AND cardinality(tags) = 0 AND image_key IS NULL AND image_url LIKE auth.uid()::text || '/' || id || '/%');

DROP POLICY IF EXISTS "Authorized sellers upload their new product photos" ON storage.objects;
CREATE POLICY "Authorized sellers upload their new product photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.can_submit_product() AND (storage.foldername(name))[1] = auth.uid()::text AND (storage.foldername(name))[2] LIKE 'seller-%');
DROP POLICY IF EXISTS "Authorized sellers remove their unsubmitted photos" ON storage.objects;
CREATE POLICY "Authorized sellers remove their unsubmitted photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND owner_id = auth.uid()::text AND (storage.foldername(name))[1] = auth.uid()::text AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.image_url = name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT ALL ON public.products TO service_role;
GRANT SELECT, UPDATE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;