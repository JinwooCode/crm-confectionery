-- =============================================================
-- CRM Confectionery - initial schema
-- Tables: profiles, customers, products, orders, order_items
-- Auth:   profile row created automatically on sign-up
-- RLS:    every public table has RLS enabled + role-based policies
-- Storage: product-images, order-files (private buckets + policies)
-- =============================================================

-- -------------------------------------------------------------
-- Types
-- -------------------------------------------------------------
-- pending = signed up but not yet approved by an admin (no data access)
create type public.user_role as enum ('admin', 'staff', 'pending');

create type public.order_status as enum ('new', 'in_progress', 'ready', 'delivered', 'cancelled');

create type public.delivery_method as enum ('pickup', 'delivery');

-- -------------------------------------------------------------
-- Private schema for helper functions (not exposed via Data API)
-- -------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.customers (
  id bigint generated always as identity primary key,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  category text,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers (id) on delete restrict,
  status public.order_status not null default 'new',
  due_date date not null,
  delivery_method public.delivery_method not null default 'pickup',
  notes text,
  total numeric(10, 2) not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

-- Indexes on foreign keys and common filters
create index customers_created_by_idx on public.customers (created_by);
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_created_by_idx on public.orders (created_by);
create index orders_due_date_idx on public.orders (due_date);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

-- -------------------------------------------------------------
-- Helper functions (used by RLS policies)
-- SECURITY DEFINER so they can read profiles without triggering
-- RLS recursion; kept in the unexposed private schema.
-- -------------------------------------------------------------
create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('staff', 'admin')
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function private.current_user_role() from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- -------------------------------------------------------------
-- Triggers
-- -------------------------------------------------------------

-- Create a profile for every new auth user.
-- The very first user becomes admin; everyone else waits for approval.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when exists (select 1 from public.profiles where role = 'admin') then 'pending'::public.user_role
      else 'admin'::public.user_role
    end
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep updated_at current
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

grant execute on function private.set_updated_at() to authenticated;

create trigger customers_set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

-- Recalculate orders.total whenever its items change (runs as the caller, RLS applies)
create or replace function private.recalc_order_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_order bigint := coalesce(new.order_id, old.order_id);
begin
  update public.orders
  set total = coalesce((
    select sum(quantity * unit_price) from public.order_items where order_id = target_order
  ), 0)
  where id = target_order;

  if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
    update public.orders
    set total = coalesce((
      select sum(quantity * unit_price) from public.order_items where order_id = old.order_id
    ), 0)
    where id = old.order_id;
  end if;

  return null;
end;
$$;

grant execute on function private.recalc_order_total() to authenticated;

create trigger order_items_recalc_total
  after insert or update or delete on public.order_items
  for each row execute function private.recalc_order_total();

-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- profiles: see yourself; staff see the team; admins manage roles
create policy "profiles_select_self_or_staff" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  -- a user can never change their own role
  with check (id = (select auth.uid()) and role = (select private.current_user_role()));

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- customers: staff read/write, only admins delete
create policy "customers_select_staff" on public.customers
  for select to authenticated using ((select private.is_staff()));
create policy "customers_insert_staff" on public.customers
  for insert to authenticated with check ((select private.is_staff()));
create policy "customers_update_staff" on public.customers
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "customers_delete_admin" on public.customers
  for delete to authenticated using ((select private.is_admin()));

-- products: staff read, only admins manage the catalog
create policy "products_select_staff" on public.products
  for select to authenticated using ((select private.is_staff()));
create policy "products_insert_admin" on public.products
  for insert to authenticated with check ((select private.is_admin()));
create policy "products_update_admin" on public.products
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "products_delete_admin" on public.products
  for delete to authenticated using ((select private.is_admin()));

-- orders: staff read/write, only admins delete
create policy "orders_select_staff" on public.orders
  for select to authenticated using ((select private.is_staff()));
create policy "orders_insert_staff" on public.orders
  for insert to authenticated
  with check ((select private.is_staff()) and created_by = (select auth.uid()));
create policy "orders_update_staff" on public.orders
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "orders_delete_admin" on public.orders
  for delete to authenticated using ((select private.is_admin()));

-- order_items: staff manage items of orders
create policy "order_items_select_staff" on public.order_items
  for select to authenticated using ((select private.is_staff()));
create policy "order_items_insert_staff" on public.order_items
  for insert to authenticated with check ((select private.is_staff()));
create policy "order_items_update_staff" on public.order_items
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "order_items_delete_staff" on public.order_items
  for delete to authenticated using ((select private.is_staff()));

-- -------------------------------------------------------------
-- Data API grants (new tables are not exposed automatically).
-- Only signed-in users get access; anon gets nothing.
-- -------------------------------------------------------------
revoke all on public.profiles, public.customers, public.products, public.orders, public.order_items from anon;

grant select on public.profiles to authenticated;
grant update (full_name, role) on public.profiles to authenticated;

grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;

-- -------------------------------------------------------------
-- Storage
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('order-files', 'order-files', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- product-images: staff view, admins upload/replace/delete
create policy "product_images_select_staff" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select private.is_staff()));
create policy "product_images_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select private.is_admin()));
create policy "product_images_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()))
  with check (bucket_id = 'product-images' and (select private.is_admin()));
create policy "product_images_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));

-- order-files: stored as <order_id>/<file>; staff manage them
create policy "order_files_select_staff" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-files' and (select private.is_staff()));
create policy "order_files_insert_staff" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'order-files' and (select private.is_staff()));
create policy "order_files_update_staff" on storage.objects
  for update to authenticated
  using (bucket_id = 'order-files' and (select private.is_staff()))
  with check (bucket_id = 'order-files' and (select private.is_staff()));
create policy "order_files_delete_staff" on storage.objects
  for delete to authenticated
  using (bucket_id = 'order-files' and (select private.is_staff()));
