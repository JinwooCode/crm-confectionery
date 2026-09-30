-- RLS smoke test: creates 2 fake users, checks access, then rolls everything back.
-- Run with: supabase db query --linked -f supabase/tests/rls_smoke_test.sql
begin;

create temp table results (check_name text, passed boolean) on commit drop;
grant all on results to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"full_name":"Test Admin"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'new@test.local', '{"full_name":"Test Pending"}', 'authenticated', 'authenticated');

-- Pre-existing admins (if any) would make the first test user pending, so force known roles.
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

insert into results
select 'signup trigger created profiles', count(*) = 2
from public.profiles where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

insert into results
select 'second user gets staff on signup', role = 'staff'
from public.profiles where id = '00000000-0000-0000-0000-00000000000b';

-- An admin can still block a user by setting them to pending; test that case below.
update public.profiles set role = 'pending' where id = '00000000-0000-0000-0000-00000000000b';

-- ---------- act as admin ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into public.customers (full_name, phone) values ('Test Customer', '050-0000000');
insert into public.products (name, price) values ('Test Cake', 100);
insert into public.orders (customer_id, due_date)
  select id, current_date + 3 from public.customers where full_name = 'Test Customer';
insert into public.order_items (order_id, product_id, quantity, unit_price)
  select o.id, p.id, 2, 100 from public.orders o, public.products p where p.name = 'Test Cake';

insert into results select 'admin sees customer', count(*) = 1 from public.customers where full_name = 'Test Customer';
insert into results select 'order total recalculated', total = 200 from public.orders limit 1;

do $$
declare
  oid bigint;
begin
  oid := public.create_order(
    (select id from public.customers limit 1), current_date + 5, 'delivery', 'test',
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products limit 1), 'quantity', 3))
  );
  insert into results
  select 'create_order rpc uses catalog price', total = 300 from public.orders where id = oid;
end $$;

-- ---------- act as pending user ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

insert into results select 'pending sees no customers', count(*) = 0 from public.customers;
insert into results select 'pending sees no orders', count(*) = 0 from public.orders;
insert into results select 'pending sees only own profile', count(*) = 1 from public.profiles;

-- pending user tries to promote themselves: WITH CHECK must reject it
do $$
begin
  update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b';
  insert into results values ('pending cannot self-promote', false);
exception when insufficient_privilege then
  insert into results values ('pending cannot self-promote', true);
end $$;

-- pending user cannot create orders through the RPC either
do $$
begin
  perform public.create_order(1, current_date, 'pickup', null, '[{"product_id":1,"quantity":1}]');
  insert into results values ('pending cannot create_order', false);
exception when insufficient_privilege then
  insert into results values ('pending cannot create_order', true);
end $$;

-- ---------- anon ----------
reset role;
set local role anon;
do $$
begin
  perform 1 from public.customers;
  insert into results values ('anon blocked from customers', false);
exception when insufficient_privilege then
  insert into results values ('anon blocked from customers', true);
end $$;

reset role;
select * from results;
rollback;
