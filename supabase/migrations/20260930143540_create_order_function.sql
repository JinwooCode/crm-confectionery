-- Create an order and its items in one transaction.
-- SECURITY INVOKER: runs as the caller, so all RLS policies still apply.
-- Unit prices are taken from the products table, not from the client.
-- items: [{"product_id": 1, "quantity": 2}, ...]
create or replace function public.create_order(
  p_customer_id bigint,
  p_due_date date,
  p_delivery_method public.delivery_method,
  p_notes text,
  p_items jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_order_id bigint;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item';
  end if;

  insert into public.orders (customer_id, due_date, delivery_method, notes)
  values (p_customer_id, p_due_date, p_delivery_method, nullif(trim(p_notes), ''))
  returning id into new_order_id;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  select new_order_id, p.id, (item ->> 'quantity')::integer, p.price
  from jsonb_array_elements(p_items) as item
  join public.products p on p.id = (item ->> 'product_id')::bigint and p.is_active;

  if not found then
    raise exception 'no valid products in order';
  end if;

  return new_order_id;
end;
$$;

revoke all on function public.create_order(bigint, date, public.delivery_method, text, jsonb) from public, anon;
grant execute on function public.create_order(bigint, date, public.delivery_method, text, jsonb) to authenticated;
