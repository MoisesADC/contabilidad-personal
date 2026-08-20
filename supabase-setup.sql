-- Configuración de la base de datos para Mi Contabilidad
-- Pegar y ejecutar en: Supabase -> SQL Editor -> New query -> Run

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Cada usuario solo puede ver y modificar SU propia fila
create policy "usuarios ven solo lo suyo"
  on public.perfiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
