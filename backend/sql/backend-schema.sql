-- Esquema del backend NestJS de Mi Contabilidad
-- Pegar y ejecutar en: Supabase -> SQL Editor -> New query -> Run

create table if not exists public.app_perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  income double precision not null default 0,
  ajuste double precision not null default 0.4
);

create table if not exists public.app_categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  monto double precision not null default 0,
  moneda text not null default 'USDT'
);

create table if not exists public.app_deudas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  moneda text not null default 'USDT',
  saldo_inicial double precision not null,
  saldo double precision not null,
  cuota double precision not null default 0,
  frec_dias integer not null default 0,
  proxima date
);

create table if not exists public.app_metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  target double precision not null,
  fecha text
);

create table if not exists public.app_movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  descripcion text not null,
  categoria_id uuid references public.app_categorias(id) on delete set null,
  monto double precision not null,
  moneda text not null,
  tipo text not null default 'gasto',
  costo_usdt double precision not null,
  deuda_id uuid references public.app_deudas(id) on delete set null,
  meta_id uuid references public.app_metas(id) on delete set null
);

create index if not exists idx_movs_user_fecha on public.app_movimientos (user_id, fecha desc);

-- El backend se conecta con la clave de la base de datos y filtra por user_id
-- en cada consulta; RLS bloquea el acceso directo desde el navegador.
alter table public.app_perfiles enable row level security;
alter table public.app_categorias enable row level security;
alter table public.app_deudas enable row level security;
alter table public.app_metas enable row level security;
alter table public.app_movimientos enable row level security;
