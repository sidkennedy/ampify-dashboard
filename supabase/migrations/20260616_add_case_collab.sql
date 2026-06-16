-- Case collaboration: per-call checklist (the "bulletproof script") + per-call chat
-- between the clinic biller and the Ampify VA. Both hang off `calls` (the case record).
--
-- Design notes:
--   * clinic_id is denormalized onto both tables so RLS reuses the existing
--     my_clinic_id() pattern without a join back to calls.
--   * Both tables are added to the supabase_realtime publication so the dashboard
--     can subscribe to live INSERTs (chat) and UPDATEs (checklist answers).
--   * The VA is an internal user. Today that maps to role='superadmin' (full access
--     via is_superadmin()). When you add a dedicated 'va' role, widen the policies.

-- ── Checklist items ───────────────────────────────────────────────────────────
create table public.case_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  call_id uuid not null references public.calls(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  item_key text not null,                 -- stable key, e.g. 'ha_allowance' (dedupe/regen)
  question text not null,                 -- what the VA asks the rep
  rationale text,                         -- why we need it (shown as helper text)
  answer_type text not null default 'text'
    check (answer_type in ('boolean', 'money', 'percent', 'text', 'frequency', 'select')),
  options jsonb,                          -- for answer_type='select'
  eligibility_path text,                  -- dot-path into EligibilityOutput for write-back
  source text not null default 'generated'
    check (source in ('generated', 'biller', 'va')),
  priority int not null default 100,      -- lower = asked first
  sort_order int not null default 0,

  answer text,                            -- captured value (typed on read)
  status text not null default 'open'
    check (status in ('open', 'answered', 'na')),

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (call_id, item_key)              -- regeneration upserts instead of duplicating
);

create trigger case_checklist_items_updated_at
  before update on public.case_checklist_items
  for each row execute function update_updated_at();

create index case_checklist_call_idx on public.case_checklist_items(call_id, priority, sort_order);

alter table public.case_checklist_items enable row level security;

create policy "superadmin full access" on public.case_checklist_items
  for all using (public.is_superadmin());

create policy "clinic members full access" on public.case_checklist_items
  for all using (clinic_id = public.my_clinic_id());

-- ── Case messages (chat) ──────────────────────────────────────────────────────
create table public.case_messages (
  id uuid primary key default uuid_generate_v4(),
  call_id uuid not null references public.calls(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  sender_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('clinic', 'va', 'system')),
  body text not null,
  read_at timestamptz,                    -- set by the *other* party when they view it

  created_at timestamptz not null default now()
);

create index case_messages_call_idx on public.case_messages(call_id, created_at);
create index case_messages_unread_idx on public.case_messages(call_id) where read_at is null;

alter table public.case_messages enable row level security;

create policy "superadmin full access" on public.case_messages
  for all using (public.is_superadmin());

create policy "clinic members full access" on public.case_messages
  for all using (clinic_id = public.my_clinic_id());

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Lets the browser client subscribe to live changes (chat + checklist answers).
alter publication supabase_realtime add table public.case_messages;
alter publication supabase_realtime add table public.case_checklist_items;
