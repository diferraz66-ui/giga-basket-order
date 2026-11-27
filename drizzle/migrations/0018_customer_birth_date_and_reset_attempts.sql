ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS accepts_offers BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_digits TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_reset_attempts TO service_role;
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS password_reset_attempts_whatsapp_idx ON public.password_reset_attempts (whatsapp_digits, attempted_at DESC);