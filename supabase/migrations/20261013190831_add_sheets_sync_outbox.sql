-- Apply before deploying the Sheets worker. New landing-page rows enqueue in
-- the same transaction as the submission; old rows are intentionally untouched.
begin;

create table public.sheets_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  kind text not null check (kind in ('waitlist', 'hiring')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'synced', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 6),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (kind, submission_id)
);

create index sheets_sync_ready_idx on public.sheets_sync_outbox (next_attempt_at, created_at)
  where status = 'pending';
create index sheets_sync_lease_idx on public.sheets_sync_outbox (leased_until)
  where status = 'processing';

alter table public.sheets_sync_outbox enable row level security;
revoke all on public.sheets_sync_outbox from public, anon, authenticated;
grant select, insert, update on public.sheets_sync_outbox to service_role;

create function app_private.enqueue_waitlist_sheet()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.sheets_sync_outbox (submission_id, kind)
  values (new.id, 'waitlist') on conflict (kind, submission_id) do nothing;
  return new;
end;
$$;

create function app_private.enqueue_hiring_sheet()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.sheets_sync_outbox (submission_id, kind)
  values (new.id, 'hiring') on conflict (kind, submission_id) do nothing;
  return new;
end;
$$;

revoke all on function app_private.enqueue_waitlist_sheet() from public, anon, authenticated;
revoke all on function app_private.enqueue_hiring_sheet() from public, anon, authenticated;

create trigger waitlist_sheet_job after insert on public.waitlist_subscribers
  for each row when (new.source = 'landing_page')
  execute function app_private.enqueue_waitlist_sheet();
create trigger hiring_sheet_job after insert on public.cleaning_applicants
  for each row when (new.source = 'landing_page')
  execute function app_private.enqueue_hiring_sheet();

create function public.claim_sheet_jobs(p_limit integer, p_submission_id uuid default null)
returns setof public.sheets_sync_outbox language plpgsql security invoker set search_path = '' as $$
begin
  update public.sheets_sync_outbox
    set status = 'failed', lease_token = null, leased_until = null,
        last_error_code = coalesce(last_error_code, 'lease_expired')
    where status = 'processing' and leased_until <= now() and attempt_count >= 6;

  return query
    with picked as (
      select id from public.sheets_sync_outbox
      where ((status = 'pending' and next_attempt_at <= now())
          or (status = 'processing' and leased_until <= now()))
        and attempt_count < 6
        and (p_submission_id is null or submission_id = p_submission_id)
      order by created_at, id
      limit least(greatest(p_limit, 1), 2)
      for update skip locked
    )
    update public.sheets_sync_outbox job
      set status = 'processing', attempt_count = job.attempt_count + 1,
          lease_token = gen_random_uuid(), leased_until = now() + interval '2 minutes'
      from picked where job.id = picked.id
      returning job.*;
end;
$$;

create function public.complete_sheet_job(
  p_id uuid, p_lease_token uuid, p_synced boolean,
  p_error_code text default null, p_retryable boolean default true
)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  update public.sheets_sync_outbox
    set status = case
          when p_synced then 'synced'
          when p_retryable and attempt_count < 6 then 'pending'
          else 'failed' end,
        last_error_code = case when p_synced then null else left(coalesce(p_error_code, 'unknown'), 80) end,
        synced_at = case when p_synced then now() else synced_at end,
        next_attempt_at = case when p_synced then next_attempt_at
          else now() + make_interval(mins => least(120, (2 ^ attempt_count)::integer)) end,
        lease_token = null, leased_until = null
    where id = p_id and status = 'processing' and lease_token = p_lease_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.claim_sheet_jobs(integer, uuid) from public, anon, authenticated;
revoke all on function public.complete_sheet_job(uuid, uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_sheet_jobs(integer, uuid) to service_role;
grant execute on function public.complete_sheet_job(uuid, uuid, boolean, text, boolean) to service_role;

commit;
