-- Run once in the Supabase SQL editor. Private user documents, atomic version checks.
create table if not exists public.journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data->>'schema' = '1'),
  revision bigint not null default 1 check (revision >= 1),
  last_mutation_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.journals enable row level security;
revoke all on public.journals from anon, authenticated;
grant select on public.journals to authenticated;
grant select on public.journals to service_role;
drop policy if exists "Read own journal" on public.journals;
create policy "Read own journal" on public.journals for select to authenticated using ((select auth.uid()) = user_id);

-- Writes only through this RPC: clients cannot bypass revision checks.
create or replace function public.save_journal(p_data jsonb, p_expected_revision bigint, p_mutation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.journals%rowtype;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mutation_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid mutation or revision' using errcode = '22023';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or p_data->>'schema' is distinct from '1'
    or jsonb_typeof(p_data->'workouts') is distinct from 'array'
    or jsonb_typeof(p_data->'exercises') is distinct from 'array'
    or jsonb_typeof(p_data->'templates') is distinct from 'array'
    or jsonb_typeof(p_data->'goals') is distinct from 'array'
    or octet_length(p_data::text) > 8388608 then
    raise exception 'Invalid journal document' using errcode = '22023';
  end if;
  -- Serializes even the first insert for a user. Hash collisions only serialize unrelated users.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select * into v_row from public.journals where user_id = v_user for update;
  if found then
    if v_row.last_mutation_id = p_mutation_id then
      return jsonb_build_object('data',v_row.data,'revision',v_row.revision,'mutationId',v_row.last_mutation_id);
    end if;
    if v_row.revision <> p_expected_revision then return null; end if;
    update public.journals set data=p_data, revision=revision+1, last_mutation_id=p_mutation_id, updated_at=now()
      where user_id=v_user returning * into v_row;
  else
    if p_expected_revision <> 0 then return null; end if;
    insert into public.journals (user_id,data,revision,last_mutation_id)
      values (v_user,p_data,1,p_mutation_id) returning * into v_row;
  end if;
  return jsonb_build_object('data',v_row.data,'revision',v_row.revision,'mutationId',v_row.last_mutation_id);
end;
$$;
revoke all on function public.save_journal(jsonb,bigint,uuid) from public, anon;
grant execute on function public.save_journal(jsonb,bigint,uuid) to authenticated;
