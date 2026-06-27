-- Panama Compra Radar - esquema inicial para Supabase/Postgres
-- Ejecutar en Supabase SQL Editor cuando se cree el proyecto online.

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'cotizador' check (role in ('admin', 'cotizador', 'lectura')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.tender_snapshots (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  tender_key text not null,
  numero text,
  titulo text,
  entidad text,
  objeto text,
  tipo_proceso text,
  estado_portal text,
  precio_referencia numeric(14,2),
  fecha_publicacion timestamptz,
  fecha_presentacion timestamptz,
  portal_url text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (team_id, tender_key)
);

create table if not exists public.workspace_items (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  tender_key text not null,
  stage text not null default 'Nuevo' check (stage in ('Nuevo', 'Revisar', 'Cotizando', 'Listo', 'Descartado')),
  priority text not null default 'Media' check (priority in ('Alta', 'Media', 'Baja')),
  favorite boolean not null default false,
  in_flow boolean not null default false,
  due_date date,
  target_margin numeric(7,2),
  tax_rate numeric(7,2) not null default 7,
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, tender_key)
);

create table if not exists public.quote_suppliers (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  tender_key text not null,
  provider_name text not null,
  contact text,
  amount numeric(14,2),
  lead_time text,
  status text not null default 'Solicitado' check (status in ('Solicitado', 'Enviado', 'Respondio', 'Negociando', 'Ganador interno', 'No participa')),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_providers (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  ruc text,
  contact text,
  category text,
  status text not null default 'Activo' check (status in ('Activo', 'Evaluar', 'No usar')),
  note text,
  source text not null default 'interno',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id),
  tender_key text,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tender_snapshots_team_due_idx on public.tender_snapshots(team_id, fecha_presentacion);
create index if not exists workspace_items_team_stage_idx on public.workspace_items(team_id, stage);
create index if not exists quote_suppliers_team_tender_idx on public.quote_suppliers(team_id, tender_key);
create index if not exists crm_providers_team_name_idx on public.crm_providers(team_id, name);

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tender_snapshots enable row level security;
alter table public.workspace_items enable row level security;
alter table public.quote_suppliers enable row level security;
alter table public.crm_providers enable row level security;
alter table public.activity_log enable row level security;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
  );
$$;

create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());

create policy "team_members_can_read_team_data" on public.teams
  for select using (public.is_team_member(id));

create policy "team_members_read" on public.team_members
  for select using (public.is_team_member(team_id));

create policy "team_tender_snapshots_all" on public.tender_snapshots
  for all using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

create policy "team_workspace_items_all" on public.workspace_items
  for all using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

create policy "team_quote_suppliers_all" on public.quote_suppliers
  for all using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

create policy "team_crm_providers_all" on public.crm_providers
  for all using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

create policy "team_activity_log_all" on public.activity_log
  for all using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));
