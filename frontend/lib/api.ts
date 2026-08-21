import { supabase } from './supabase';

const API = process.env.NEXT_PUBLIC_API_URL!;

// ── Tipos que devuelve el backend NestJS ─────────────────────────
export type Moneda = 'USDT' | 'USD_BCV' | 'BS';

export interface Tasas {
  bcv: number;
  paralelo: number | null;
  binance: number;
  updatedAt: string;
}

export interface Perfil {
  userId: string;
  income: number;
  ajuste: number;
}

// 'fijo' = gasto mensual predecible · 'diario' = gasto variable del día a día
export type TipoGasto = 'fijo' | 'diario';

export interface Categoria {
  id: string;
  nombre: string;
  monto: number;
  moneda: Moneda;
  tipo: TipoGasto;
}

export interface Deuda {
  id: string;
  nombre: string;
  moneda: Moneda;
  saldoInicial: number;
  saldo: number;
  cuota: number;
  frecDias: number;
  proxima: string | null;
}

export interface Meta {
  id: string;
  nombre: string;
  target: number;
  fecha: string | null;
  ahorrado: number;
}

export interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  categoriaId: string | null;
  monto: number;
  moneda: Moneda;
  tipo: 'gasto' | 'ingreso';
  costoUsdt: number;
  deudaId: string | null;
  metaId: string | null;
}

// ── Cliente HTTP con el token de sesión ──────────────────────────
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(API + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message?.toString?.() ?? `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  tasas: () => apiFetch<Tasas>('/tasas'),
  perfil: {
    get: () => apiFetch<Perfil>('/perfil'),
    save: (p: { income: number; ajuste: number }) =>
      apiFetch<Perfil>('/perfil', { method: 'PUT', body: JSON.stringify(p) }),
  },
  categorias: {
    list: () => apiFetch<Categoria[]>('/categorias'),
    create: (c: Omit<Categoria, 'id'>) =>
      apiFetch<Categoria>('/categorias', { method: 'POST', body: JSON.stringify(c) }),
    update: (id: string, c: Omit<Categoria, 'id'>) =>
      apiFetch<Categoria>(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify(c) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/categorias/${id}`, { method: 'DELETE' }),
  },
  deudas: {
    list: () => apiFetch<Deuda[]>('/deudas'),
    create: (d: {
      nombre: string;
      moneda: Moneda;
      saldoInicial: number;
      cuota?: number;
      frecDias?: number;
      proxima?: string;
    }) => apiFetch<Deuda>('/deudas', { method: 'POST', body: JSON.stringify(d) }),
    abonar: (id: string, a: { monto: number; fecha?: string }) =>
      apiFetch<{ deuda: Deuda; movimiento: Movimiento }>(`/deudas/${id}/abonos`, {
        method: 'POST',
        body: JSON.stringify(a),
      }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/deudas/${id}`, { method: 'DELETE' }),
  },
  metas: {
    list: () => apiFetch<Meta[]>('/metas'),
    create: (m: { nombre: string; target: number; fecha?: string }) =>
      apiFetch<Meta>('/metas', { method: 'POST', body: JSON.stringify(m) }),
    aportar: (id: string, a: { monto: number; fecha?: string; descripcion?: string }) =>
      apiFetch<Movimiento>(`/metas/${id}/aportes`, { method: 'POST', body: JSON.stringify(a) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/metas/${id}`, { method: 'DELETE' }),
  },
  movimientos: {
    list: (mes?: string) =>
      apiFetch<Movimiento[]>('/movimientos' + (mes ? `?mes=${mes}` : '')),
    create: (m: {
      fecha: string;
      descripcion: string;
      categoriaId?: string;
      monto: number;
      moneda: Moneda;
      tipo: 'gasto' | 'ingreso';
    }) => apiFetch<Movimiento>('/movimientos', { method: 'POST', body: JSON.stringify(m) }),
    remove: (id: string) => apiFetch<{ ok: true }>(`/movimientos/${id}`, { method: 'DELETE' }),
  },
};
