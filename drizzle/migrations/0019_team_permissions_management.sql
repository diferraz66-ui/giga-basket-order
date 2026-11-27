ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS pode_ver_todos_pedidos BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pode_editar_pedidos BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pode_cancelar_pedidos BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pode_ignorar_pedido_minimo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pode_anexar_pix BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pode_enviar_orientacoes_pix BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pode_alterar_status_produtos BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pode_ver_totais_financeiros BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.team_members
SET
  pode_ver_todos_pedidos = TRUE,
  pode_editar_pedidos = TRUE,
  pode_cancelar_pedidos = TRUE,
  pode_ignorar_pedido_minimo = TRUE,
  pode_anexar_pix = TRUE,
  pode_enviar_orientacoes_pix = TRUE,
  pode_cadastrar_produtos = COALESCE(pode_cadastrar_produtos, TRUE),
  pode_alterar_status_produtos = TRUE,
  pode_ver_totais_financeiros = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_username_unique
ON public.team_members (username);

CREATE OR REPLACE FUNCTION public.enforce_team_active_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(72415021);

  SELECT COUNT(*)
  INTO active_count
  FROM public.team_members
  WHERE active = TRUE
    AND user_id <> COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF NEW.active = TRUE AND active_count >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 colaboradores ativos atingido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_active_limit ON public.team_members;
CREATE TRIGGER trg_team_active_limit
BEFORE INSERT OR UPDATE OF active ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_team_active_limit();

CREATE OR REPLACE FUNCTION public.protect_team_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (
      NEW.pode_ver_todos_pedidos IS DISTINCT FROM OLD.pode_ver_todos_pedidos OR
      NEW.pode_editar_pedidos IS DISTINCT FROM OLD.pode_editar_pedidos OR
      NEW.pode_cancelar_pedidos IS DISTINCT FROM OLD.pode_cancelar_pedidos OR
      NEW.pode_ignorar_pedido_minimo IS DISTINCT FROM OLD.pode_ignorar_pedido_minimo OR
      NEW.pode_anexar_pix IS DISTINCT FROM OLD.pode_anexar_pix OR
      NEW.pode_enviar_orientacoes_pix IS DISTINCT FROM OLD.pode_enviar_orientacoes_pix OR
      NEW.pode_cadastrar_produtos IS DISTINCT FROM OLD.pode_cadastrar_produtos OR
      NEW.pode_alterar_status_produtos IS DISTINCT FROM OLD.pode_alterar_status_produtos OR
      NEW.pode_ver_totais_financeiros IS DISTINCT FROM OLD.pode_ver_totais_financeiros OR
      NEW.active IS DISTINCT FROM OLD.active
    ) THEN
      IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Somente Admin pode alterar permissões ou acesso da equipe';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_team_permissions ON public.team_members;
CREATE TRIGGER trg_protect_team_permissions
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.protect_team_permissions();

CREATE OR REPLACE FUNCTION public.admin_update_team_permissions(
  p_user_id UUID,
  p_pode_ver_todos_pedidos BOOLEAN,
  p_pode_editar_pedidos BOOLEAN,
  p_pode_cancelar_pedidos BOOLEAN,
  p_pode_ignorar_pedido_minimo BOOLEAN,
  p_pode_anexar_pix BOOLEAN,
  p_pode_enviar_orientacoes_pix BOOLEAN,
  p_pode_cadastrar_produtos BOOLEAN,
  p_pode_alterar_status_produtos BOOLEAN,
  p_pode_ver_totais_financeiros BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado. Somente Admin.';
  END IF;

  UPDATE public.team_members
  SET
    pode_ver_todos_pedidos = p_pode_ver_todos_pedidos,
    pode_editar_pedidos = p_pode_editar_pedidos,
    pode_cancelar_pedidos = p_pode_cancelar_pedidos,
    pode_ignorar_pedido_minimo = p_pode_ignorar_pedido_minimo,
    pode_anexar_pix = p_pode_anexar_pix,
    pode_enviar_orientacoes_pix = p_pode_enviar_orientacoes_pix,
    pode_cadastrar_produtos = p_pode_cadastrar_produtos,
    pode_alterar_status_produtos = p_pode_alterar_status_produtos,
    pode_ver_totais_financeiros = p_pode_ver_totais_financeiros
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_team_permissions(
  UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN,
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_update_team_permissions(
  UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN,
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) TO authenticated;