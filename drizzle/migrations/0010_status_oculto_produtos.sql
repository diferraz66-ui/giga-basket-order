-- Status "Oculto" para produtos (novo valor 'hidden' em products.status)
ALTER TABLE public.products
  DROP CONSTRAINT products_status_check,
  ADD CONSTRAINT products_status_check CHECK (status IN ('available','out_of_stock','hidden'));
