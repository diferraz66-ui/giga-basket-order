ALTER TABLE public.products DROP CONSTRAINT products_category_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category = ANY (ARRAY[
    'cozinha'::text,
    'casa-decoracao'::text,
    'organizacao'::text,
    'beleza'::text,
    'papelaria'::text,
    'brinquedos'::text,
    'ferramentas'::text,
    'utilidades'::text,
    'acessorios'::text,
    'novidades'::text
  ]));