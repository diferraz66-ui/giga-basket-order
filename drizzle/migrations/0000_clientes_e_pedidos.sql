CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  whatsapp text NOT NULL UNIQUE,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_opt_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes veem o próprio perfil" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Clientes editam o próprio perfil" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  opt_in boolean := COALESCE((NEW.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false);
BEGIN
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.marketing_opt_in AND NOT OLD.marketing_opt_in THEN
    NEW.marketing_opt_in_at := now();
  ELSIF NOT NEW.marketing_opt_in THEN
    NEW.marketing_opt_in_at := NULL;
  END IF;
  NEW.whatsapp := OLD.whatsapp;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_profile();

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  customer_name text NOT NULL,
  customer_whatsapp text NOT NULL,
  items jsonb NOT NULL,
  total numeric(10,2) NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes criam os próprios pedidos" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Clientes veem os próprios pedidos" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX orders_user_id_idx ON public.orders (user_id, created_at DESC);