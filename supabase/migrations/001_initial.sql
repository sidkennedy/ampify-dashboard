-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clinics
create table public.clinics (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  npi text,
  tax_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  role text not null default 'staff' check (role in ('staff', 'admin', 'superadmin')),
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

-- Templates
create table public.templates (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  codes_requested text not null,
  created_at timestamptz not null default now()
);

-- Calls
create table public.calls (
  id uuid primary key default uuid_generate_v4(),
  vapi_call_id text unique,
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  -- Patient info
  patient_name text not null,
  dob text not null,
  member_id text not null,

  -- Provider info
  provider_npi text,
  clinic_tax_id text,
  clinic_name text,
  clinic_address text,

  -- Call details
  insurance_phone text not null,
  codes_requested text not null,
  phone_number_id text,

  -- Status
  status text not null default 'queued' check (status in ('queued', 'scheduled', 'in_progress', 'completed', 'failed')),
  scheduled_for timestamptz,

  -- Results
  structured_output_eligibility jsonb,
  structured_output_codes jsonb,
  transcript text,
  recording_url text,
  duration_seconds integer,
  ended_reason text,
  cost numeric(10, 4),

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger calls_updated_at
  before update on public.calls
  for each row execute function update_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS Policies
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.calls enable row level security;

-- Superadmin helper
create or replace function public.is_superadmin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$ language sql security definer;

-- Clinic helper
create or replace function public.my_clinic_id()
returns uuid as $$
  select clinic_id from public.profiles where id = auth.uid();
$$ language sql security definer;

-- Clinics policies
create policy "superadmin full access" on public.clinics
  for all using (public.is_superadmin());

create policy "members see own clinic" on public.clinics
  for select using (id = public.my_clinic_id());

create policy "admin update own clinic" on public.clinics
  for update using (id = public.my_clinic_id() and exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin', 'superadmin')
  ));

-- Profiles policies
create policy "superadmin full access" on public.profiles
  for all using (public.is_superadmin());

create policy "users see own profile" on public.profiles
  for select using (id = auth.uid());

create policy "users update own profile" on public.profiles
  for update using (id = auth.uid());

create policy "clinic members see teammates" on public.profiles
  for select using (clinic_id = public.my_clinic_id());

-- Templates policies
create policy "superadmin full access" on public.templates
  for all using (public.is_superadmin());

create policy "clinic members full access" on public.templates
  for all using (clinic_id = public.my_clinic_id());

-- Calls policies
create policy "superadmin full access" on public.calls
  for all using (public.is_superadmin());

create policy "clinic members full access" on public.calls
  for all using (clinic_id = public.my_clinic_id());

-- Indexes
create index calls_clinic_id_idx on public.calls(clinic_id);
create index calls_status_idx on public.calls(status);
create index calls_created_at_idx on public.calls(created_at desc);
create index calls_vapi_call_id_idx on public.calls(vapi_call_id);
create index calls_patient_name_idx on public.calls using gin(to_tsvector('english', patient_name));
