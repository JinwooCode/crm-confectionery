-- New users get staff access immediately (no admin approval step).
-- The very first user still becomes admin. Admins can still set a user
-- to 'pending' from the Users screen to block their access.
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
      when exists (select 1 from public.profiles where role = 'admin') then 'staff'::public.user_role
      else 'admin'::public.user_role
    end
  );
  return new;
end;
$$;

-- Users who were waiting for approval get access now.
update public.profiles set role = 'staff' where role = 'pending';
