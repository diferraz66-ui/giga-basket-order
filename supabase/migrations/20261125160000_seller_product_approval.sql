-- Aprovação de produtos cadastrados por vendedores
alter table public.team_members
  add column if not exists pode_cadastrar_produtos boolean not null default false;

alter table public.products
  add column if not exists status_aprovacao text not null default 'aprovado',
  add column if not exists cadastrado_por text;

update public.products set status_aprovacao = 'aprovado'
where status_aprovacao is null;

alter table public.products
  alter column status_aprovacao set default 'aprovado',
  alter column status_aprovacao set not null;
do $
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_status_aprovacao_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_status_aprovacao_check
      check (status_aprovacao in ('aprovado', 'pendente'));
  end if;
end $$;
end $$;
create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.team_members tm on tm.user_id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
      and tm.active = true
  );
$$;

create or replace function public.can_submit_product()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.team_members tm on tm.user_id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role = 'vendedor'
      and tm.active = true
      and tm.pode_cadastrar_produtos = true
  );
$$;

revoke all on function public.is_active_admin() from public;
revoke all on function public.can_submit_product() from public;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.can_submit_product() to authenticated;

-- A tabela pode ter políticas legadas permissivas; substituímos as políticas
-- de escrita para garantir que vendedores não ganhem UPDATE/DELETE por outra regra.
drop policy if exists "Admins manage product approval status" on public.products;
drop policy if exists "Only admins update products" on public.products;
drop policy if exists "Authenticated users can update products" on public.products;
drop policy if exists "Admins can update products" on public.products;
create policy "Only admins update products"
on public.products for update to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists "Authorized sellers submit pending products" on public.products;
create policy "Authorized sellers submit pending products"
on public.products for insert to authenticated
with check (
  public.can_submit_product()
  and status_aprovacao = 'pendente'
  and cadastrado_por = auth.uid()::text
  and price = 7.50
  and status = 'available'
);

-- Restringe a escrita em team_members ao Admin, inclusive os campos de permissão.
drop policy if exists "Admins manage seller product permission" on public.team_members;
drop policy if exists "Only admins update team members" on public.team_members;
drop policy if exists "Admins can update team members" on public.team_members;
create policy "Only admins update team members"
on public.team_members for update to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

-- Escrita em produtos fica disponível somente para Admin, exceto o INSERT
-- pendente e limitado aos vendedores autorizados definido acima.
drop policy if exists "Only admins delete products" on public.products;
create policy "Only admins delete products"
on public.products for delete to authenticated
using (public.is_active_admin());

-- RLS das duas tabelas deve estar ativa para que as políticas sejam aplicadas.
alter table public.products enable row level security;
alter table public.team_members enable row level security;

-- Evita acesso de escrita em produtos por políticas permissivas antigas.
drop policy if exists "Anyone can insert products" on public.products;
drop policy if exists "Authenticated users can insert products" on public.products;
drop policy if exists "Authenticated users can delete products" on public.products;
drop policy if exists "Admins manage products" on public.products;
drop policy if exists "Anyone can update products" on public.products;
drop policy if exists "Public can update products" on public.products;
drop policy if exists "Public can insert products" on public.products;
drop policy if exists "Public can delete products" on public.products;
