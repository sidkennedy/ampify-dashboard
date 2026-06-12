-- Claim status tracking (276/277). Billers add claims they've submitted; the
-- system checks status with the payer on demand. Gated by the clinic's
-- 'claim_status' feature flag in the app.
create table if not exists public.claims (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  -- patient / subscriber
  patient_name text not null,
  patient_dob text,
  gender text,
  member_id text not null,

  -- payer + claim
  payer_stedi_id text not null,
  payer_name text,
  service_date_from date not null,
  service_date_to date,
  charge_amount numeric(10,2),

  -- status results (from the 277)
  status text not null default 'unchecked', -- unchecked | paid | denied | pending | acknowledged | not_found | error
  status_detail text,
  paid_amount numeric(10,2),
  payer_claim_number text,
  last_checked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.claims enable row level security;
create policy "superadmin full access" on public.claims for all using (public.is_superadmin());
create policy "clinic members full access" on public.claims for all using (clinic_id = public.my_clinic_id());

create index if not exists claims_clinic_id_idx on public.claims(clinic_id);
create index if not exists claims_created_at_idx on public.claims(created_at desc);

create trigger claims_updated_at before update on public.claims
  for each row execute function update_updated_at();
