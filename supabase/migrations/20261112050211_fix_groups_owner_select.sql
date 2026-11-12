-- INSERT ... RETURNING on groups is checked against the SELECT policy.
-- is_member() can't yet see the owner's membership row (added by the AFTER trigger
-- in the same statement), so owners must be allowed to read their own groups directly.
drop policy if exists "groups read" on public.groups;
create policy "groups read" on public.groups for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_member(id)
    or exists (
      select 1 from public.invites i
      where i.group_id = groups.id
        and i.email = lower(auth.jwt()->>'email')
        and i.status = 'pending'
    )
  );
