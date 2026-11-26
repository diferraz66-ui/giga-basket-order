REVOKE ALL ON public.configuracoes_loja FROM anon, authenticated;
GRANT SELECT ON public.configuracoes_loja TO anon;
GRANT SELECT, INSERT, UPDATE ON public.configuracoes_loja TO authenticated;
GRANT ALL ON public.configuracoes_loja TO service_role;