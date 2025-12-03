-- Forms, submissions, calls, and lead pipeline extensions

-- Forms table
create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  fields jsonb not null default '{}'::jsonb,
  embed_token text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Form submissions table
create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','queued','called','completed','failed')),
  created_at timestamptz not null default now()
);

-- Calls table
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  form_submission_id uuid references public.form_submissions (id) on delete set null,
  phone text,
  call_sid text,
  status text not null default 'initiated',
  room_name text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  analysis jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Lead pipeline extensions
alter table public.leads
  add column if not exists source text,
  add column if not exists last_call_id uuid references public.calls (id) on delete set null,
  add column if not exists last_call_summary text,
  add column if not exists timeline text,
  add column if not exists budget_confirmed numeric;

-- Normalize stage casing and set default
update public.leads
  set stage = lower(stage)
  where stage is not null and stage <> lower(stage);

alter table public.leads
  alter column stage set default 'new';

-- Indexes
create index if not exists idx_forms_slug on public.forms(slug);
create index if not exists idx_form_submissions_form on public.form_submissions(form_id);
create index if not exists idx_form_submissions_lead on public.form_submissions(lead_id);
create index if not exists idx_calls_lead on public.calls(lead_id);
create index if not exists idx_calls_status on public.calls(status);
create index if not exists idx_calls_started_at on public.calls(started_at desc);
create index if not exists idx_leads_source on public.leads(source);
create index if not exists idx_leads_stage_lower on public.leads((lower(stage)));

-- RLS
alter table public.forms enable row level security;
alter table public.form_submissions enable row level security;
alter table public.calls enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'forms' and policyname = 'forms service role'
  ) then
    create policy "forms service role" on public.forms for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'form_submissions' and policyname = 'form_submissions service role'
  ) then
    create policy "form_submissions service role" on public.form_submissions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'calls' and policyname = 'calls service role'
  ) then
    create policy "calls service role" on public.calls for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end$$;
