-- One UPDATE policy instead of two permissive ones (advisor 0006).
-- Users may edit their own profile but never their own role; admins may edit anyone.
drop policy "profiles_update_self" on public.profiles;
drop policy "profiles_update_admin" on public.profiles;

create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (
    (select private.is_admin())
    or (id = (select auth.uid()) and role = (select private.current_user_role()))
  );
