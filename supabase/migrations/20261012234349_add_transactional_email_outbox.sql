-- Apply before deploying the email worker. A trigger creates both jobs in the
-- same transaction as each new landing-page submission.
begin;

-- A browser retry of one hiring attempt reuses this key. NULL keeps all older
-- applications compatible, and a later deliberate application gets a new key.
alter table public.cleaning_applicants add column submission_key uuid unique;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  idempotency_key text not null unique,
  kind text not null check (kind in (
    'waitlist_confirmation', 'waitlist_notification',
    'hiring_confirmation', 'hiring_notification'
  )),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  leased_until timestamptz,
  resend_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index email_outbox_ready_idx on public.email_outbox (next_attempt_at, created_at)
  where status = 'pending';
create index email_outbox_lease_idx on public.email_outbox (leased_until)
  where status = 'processing';
create index email_outbox_submission_idx on public.email_outbox (submission_id);

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;
grant select, insert, update on public.email_outbox to service_role;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;

create function app_private.enqueue_waitlist_email()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.email_outbox (submission_id, idempotency_key, kind, payload)
  values
    (new.id, 'waitlist:' || new.id || ':customer-confirmation', 'waitlist_confirmation',
      jsonb_build_object('email', new.email, 'created_at', new.created_at)),
    (new.id, 'waitlist:' || new.id || ':admin-notification', 'waitlist_notification',
      jsonb_build_object('email', new.email, 'created_at', new.created_at));
  return new;
end;
$$;

create function app_private.enqueue_hiring_email()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.email_outbox (submission_id, idempotency_key, kind, payload)
  values
    (new.id, 'hiring:' || new.id || ':applicant-confirmation', 'hiring_confirmation',
      jsonb_build_object('email', new.email, 'first_name', new.first_name)),
    (new.id, 'hiring:' || new.id || ':admin-notification', 'hiring_notification',
      jsonb_build_object('email', new.email, 'first_name', new.first_name,
        'last_name', new.last_name, 'phone', new.phone, 'city', new.city,
        'state', new.state, 'created_at', new.created_at));
  return new;
end;
$$;

revoke all on function app_private.enqueue_waitlist_email() from public, anon, authenticated;
revoke all on function app_private.enqueue_hiring_email() from public, anon, authenticated;

create trigger waitlist_email_jobs after insert on public.waitlist_subscribers
  for each row when (new.source = 'landing_page')
  execute function app_private.enqueue_waitlist_email();
create trigger hiring_email_jobs after insert on public.cleaning_applicants
  for each row when (new.source = 'landing_page')
  execute function app_private.enqueue_hiring_email();

create function public.claim_email_jobs(p_limit integer, p_submission_id uuid default null)
returns setof public.email_outbox language plpgsql security invoker set search_path = '' as $$
begin
  -- A crashed worker's final lease must not remain in processing forever.
  update public.email_outbox
    set status = 'failed', lease_token = null, leased_until = null,
        last_error_code = coalesce(last_error_code, 'lease_expired')
    where status = 'processing' and leased_until <= now() and attempt_count >= 5;

  return query
    with picked as (
      select id from public.email_outbox
      where (status = 'pending' and next_attempt_at <= now()
          or status = 'processing' and leased_until <= now())
        and attempt_count < 5
        and (p_submission_id is null or submission_id = p_submission_id)
      order by created_at, id
      limit least(greatest(p_limit, 1), 10)
      for update skip locked
    )
    update public.email_outbox job
      set status = 'processing', attempt_count = job.attempt_count + 1,
          lease_token = gen_random_uuid(), leased_until = now() + interval '2 minutes'
      from picked where job.id = picked.id
      returning job.*;
end;
$$;

create function public.complete_email_job(
  p_id uuid, p_lease_token uuid, p_delivered boolean,
  p_resend_id text default null, p_error_code text default null,
  p_retryable boolean default true
)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  update public.email_outbox
    set status = case
          when p_delivered then 'sent'
          when p_retryable and attempt_count < 5 then 'pending'
          else 'failed' end,
        resend_message_id = case when p_delivered then p_resend_id else resend_message_id end,
        last_error_code = case when p_delivered then null else left(coalesce(p_error_code, 'unknown'), 80) end,
        sent_at = case when p_delivered then now() else sent_at end,
        next_attempt_at = case when p_delivered then next_attempt_at
          else now() + make_interval(mins => least(60, (2 ^ attempt_count)::integer)) end,
        lease_token = null, leased_until = null
    where id = p_id and status = 'processing' and lease_token = p_lease_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.claim_email_jobs(integer, uuid) from public, anon, authenticated;
revoke all on function public.complete_email_job(uuid, uuid, boolean, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_email_jobs(integer, uuid) to service_role;
grant execute on function public.complete_email_job(uuid, uuid, boolean, text, text, boolean) to service_role;

commit;
