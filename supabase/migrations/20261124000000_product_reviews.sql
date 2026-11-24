create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 100),
  city text not null check (char_length(trim(city)) between 2 and 100),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 1 and 250),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null,
  constraint product_reviews_order_product_unique unique (order_id, product_id)
);

create index if not exists product_reviews_public_product_idx
  on public.product_reviews (product_id, created_at desc)
  where status = 'aprovado';
create index if not exists product_reviews_status_created_idx
  on public.product_reviews (status, created_at desc);

alter table public.product_reviews enable row level security;

grant select on public.product_reviews to anon, authenticated;
grant insert, update, delete on public.product_reviews to authenticated;

drop policy if exists "Anyone can read approved reviews and owners/admins can read theirs" on public.product_reviews;
create policy "Anyone can read approved reviews and owners/admins can read theirs"
  on public.product_reviews for select
  using (
    status = 'aprovado'
    or user_id = auth.uid()
    or public.has_role('admin'::public.app_role, auth.uid())
  );

drop policy if exists "Customers can submit reviews for completed purchases" on public.product_reviews;
create policy "Customers can submit reviews for completed purchases"
  on public.product_reviews for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pendente'
    and moderated_at is null
    and moderated_by is null
    and exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.user_id = auth.uid()
        and o.status = 'completed'
        and jsonb_typeof(o.items) = 'array'
        and exists (
          select 1
          from jsonb_array_elements(o.items) item
          where item ->> 'id' = product_id
        )
    )
  );

drop policy if exists "Only admins can moderate reviews" on public.product_reviews;
create policy "Only admins can moderate reviews"
  on public.product_reviews for update
  to authenticated
  using (public.has_role('admin'::public.app_role, auth.uid()))
  with check (public.has_role('admin'::public.app_role, auth.uid()));

drop policy if exists "Only admins can delete reviews" on public.product_reviews;
create policy "Only admins can delete reviews"
  on public.product_reviews for delete
  to authenticated
  using (public.has_role('admin'::public.app_role, auth.uid()));
