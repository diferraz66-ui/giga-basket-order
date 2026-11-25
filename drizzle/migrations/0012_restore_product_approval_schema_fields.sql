ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS pode_cadastrar_produtos boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado', ADD COLUMN IF NOT EXISTS cadastrado_por text;
ALTER TABLE public.products ADD CONSTRAINT products_status_aprovacao_check CHECK (status_aprovacao IN ('aprovado','pendente'));