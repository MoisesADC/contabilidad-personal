'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  api,
  type Categoria,
  type Deuda,
  type Meta,
  type Moneda,
  type Movimiento,
  type Perfil,
  type Tasas,
} from '@/lib/api';
import { binanceEfectiva, convertir, etiquetaMoneda, fmt, mesActual } from '@/lib/finanzas';
import { Boton, Campo, Tarjeta, ToastProvider, estiloInput, iconos, useToast } from '@/components/ui';
import Resumen from '@/components/Resumen';
import Movimientos from '@/components/Movimientos';
import Deudas from '@/components/Deudas';
import Metas from '@/components/Metas';
import Ajustes from '@/components/Ajustes';

// ── Estado global de la app tras iniciar sesión ──────────────────
export interface AppData {
  tasas: Tasas;
  perfil: Perfil;
  categorias: Categoria[];
  deudas: Deuda[];
  metas: Meta[];
  movimientos: Movimiento[];
  mes: string;
  setMes: (m: string) => void;
  recargar: () => Promise<void>;
  email: string;
}

const PESTANAS = [
  { id: 'resumen', nombre: 'Resumen', icono: iconos.resumen },
  { id: 'movs', nombre: 'Registrar', icono: iconos.movimientos },
  { id: 'deudas', nombre: 'Deudas', icono: iconos.deudas },
  { id: 'metas', nombre: 'Metas', icono: iconos.metas },
  { id: 'ajustes', nombre: 'Ajustes', icono: iconos.ajustes },
] as const;

export default function Home() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined)
    return <p className="p-10 text-center text-sutil">Cargando…</p>;
  if (!session) return <Login />;
  return <App email={session.user.email ?? ''} />;
}

// ── Pantalla de inicio de sesión (correo + contraseña) ───────────
function Login() {
  const toast = useToast();
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [cargando, setCargando] = useState(false);
  const [confirmarCorreo, setConfirmarCorreo] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (clave.length < 8) return toast('La contraseña debe tener al menos 8 caracteres', true);
    if (modo === 'crear' && clave !== clave2) return toast('Las contraseñas no coinciden', true);
    setCargando(true);
    try {
      if (modo === 'crear') {
        const { data, error } = await supabase.auth.signUp({ email, password: clave });
        if (error) throw error;
        if (!data.session) {
          setConfirmarCorreo(true);
          return;
        }
        toast('¡Cuenta creada! Bienvenido 🎉');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
        if (error)
          throw new Error(
            /invalid login/i.test(error.message)
              ? 'Correo o contraseña incorrectos'
              : error.message,
          );
      }
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Contabilidad</h1>
        <p className="mt-1 text-sm text-sutil">
          Tus finanzas en dólares reales: tasas BCV y Binance, deudas, presupuesto y metas.
        </p>
      </div>
      <Tarjeta>
        {confirmarCorreo ? (
          <div className="text-sm leading-relaxed">
            <p className="font-semibold text-verde">Cuenta creada ✓</p>
            <p className="mt-2 text-sutil">
              Revisa tu correo (también spam) y toca el enlace de confirmación. Después vuelve
              aquí y entra con tu contraseña.
            </p>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-3">
            <div className="mb-1 grid grid-cols-2 gap-1 rounded-lg bg-panel2 p-1" role="tablist">
              {(['entrar', 'crear'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={modo === m}
                  onClick={() => setModo(m)}
                  className={`cursor-pointer rounded-md py-2 text-sm font-semibold transition-colors ${
                    modo === m ? 'bg-primario-fuerte text-white' : 'text-sutil hover:text-texto'
                  }`}
                >
                  {m === 'entrar' ? 'Entrar' : 'Crear cuenta'}
                </button>
              ))}
            </div>
            <Campo etiqueta="Correo">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@gmail.com"
                className={estiloInput}
              />
            </Campo>
            <Campo etiqueta="Contraseña">
              <input
                type="password"
                required
                autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="mínimo 8 caracteres"
                className={estiloInput}
              />
            </Campo>
            {modo === 'crear' && (
              <Campo etiqueta="Repite la contraseña">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={clave2}
                  onChange={(e) => setClave2(e.target.value)}
                  className={estiloInput}
                />
              </Campo>
            )}
            <Boton type="submit" disabled={cargando}>
              {cargando ? 'Un momento…' : modo === 'crear' ? 'Crear mi cuenta' : 'Entrar'}
            </Boton>
            <p className="text-xs text-sutil">
              Cada usuario tiene su cuenta y ve únicamente sus propios datos.
            </p>
          </form>
        )}
      </Tarjeta>
    </main>
  );
}

// ── Aplicación autenticada ───────────────────────────────────────
function App({ email }: { email: string }) {
  const toast = useToast();
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['id']>('resumen');
  const [mes, setMes] = useState(mesActual());
  const [tasas, setTasas] = useState<Tasas | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try {
      const [t, p, c, d, m, mv] = await Promise.all([
        api.tasas(),
        api.perfil.get(),
        api.categorias.list(),
        api.deudas.list(),
        api.metas.list(),
        api.movimientos.list(mes),
      ]);
      setTasas(t);
      setPerfil(p);
      setCategorias(c);
      setDeudas(d);
      setMetas(m);
      setMovimientos(mv);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mes]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const app: AppData | null = useMemo(
    () =>
      tasas && perfil
        ? { tasas, perfil, categorias, deudas, metas, movimientos, mes, setMes, recargar, email }
        : null,
    [tasas, perfil, categorias, deudas, metas, movimientos, mes, recargar, email],
  );

  if (error && !app)
    return (
      <main className="mx-auto max-w-sm p-6 text-center">
        <p className="mt-20 text-sm text-rojo">No se pudo conectar con el servidor: {error}</p>
        <Boton className="mt-4" onClick={recargar}>
          Reintentar
        </Boton>
      </main>
    );
  if (!app) return <p className="p-10 text-center text-sutil">Cargando tus datos…</p>;

  return (
    <div className="mx-auto max-w-4xl px-3 pb-24 pt-3 sm:px-4">
      <BarraTasas app={app} onActualizar={async () => { await recargar(); toast('Tasas actualizadas ✓'); }} />
      <main className="mt-3">
        {pestana === 'resumen' && <Resumen app={app} />}
        {pestana === 'movs' && <Movimientos app={app} />}
        {pestana === 'deudas' && <Deudas app={app} />}
        {pestana === 'metas' && <Metas app={app} />}
        {pestana === 'ajustes' && <Ajustes app={app} />}
      </main>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-panel/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-4xl">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              aria-current={pestana === p.id ? 'page' : undefined}
              className={`flex min-h-14 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200 ${
                pestana === p.id ? 'text-primario' : 'text-sutil hover:text-texto'
              }`}
            >
              {p.icono()}
              {p.nombre}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ── Barra de tasas + calculadora plegables ───────────────────────
function BarraTasas({ app, onActualizar }: { app: AppData; onActualizar: () => void }) {
  const { tasas, perfil } = app;
  const ef = binanceEfectiva(tasas, perfil.ajuste);
  const [calcMonto, setCalcMonto] = useState('');
  const [calcMoneda, setCalcMoneda] = useState<Moneda>('USDT');
  const monto = parseFloat(calcMonto);
  const hayMonto = monto > 0;
  // Las otras dos monedas, en orden fijo, para mostrar ambas conversiones
  const destinos = (['USDT', 'BS', 'USD_BCV'] as Moneda[]).filter((m) => m !== calcMoneda);

  return (
    <header className="flex flex-col gap-2">
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-borde bg-panel px-4 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Tasas del día
          <span className="text-xs font-normal text-sutil">
            BCV {fmt(tasas.bcv, 0)} · Binance {fmt(ef, 0)}
          </span>
          <span className="ml-auto text-sutil transition-transform duration-200 group-open:rotate-180">▾</span>
        </summary>
        <div className="rounded-b-xl border border-t-0 border-borde bg-panel px-4 py-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <Chip etiqueta="BCV oficial" valor={fmt(tasas.bcv)} color="text-ambar" />
            <Chip etiqueta="Binance P2P" valor={fmt(tasas.binance)} />
            <Chip etiqueta={`Estimado (-${fmt(perfil.ajuste, 1)}%)`} valor={fmt(ef)} color="text-verde" />
            <Chip etiqueta="Brecha" valor={fmt((ef / tasas.bcv - 1) * 100, 1) + '%'} />
            <Chip etiqueta="$1 BCV te cuesta" valor={'$' + fmt(tasas.bcv / ef, 3)} color="text-verde" />
            <Boton variante="secundario" onClick={onActualizar} className="ml-auto !min-h-9 !px-3 !text-xs">
              {iconos.actualizar({ className: 'size-4' })} Actualizar
            </Boton>
          </div>
        </div>
      </details>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-borde bg-panel px-4 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Calculadora de cambio
          <span className="ml-auto text-sutil transition-transform duration-200 group-open:rotate-180">▾</span>
        </summary>
        <div className="rounded-b-xl border border-t-0 border-borde bg-panel px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <Campo etiqueta="Tengo">
              <input
                type="number"
                inputMode="decimal"
                value={calcMonto}
                onChange={(e) => setCalcMonto(e.target.value)}
                placeholder="100"
                className={`${estiloInput} max-w-32`}
              />
            </Campo>
            <Campo etiqueta="En">
              <select
                value={calcMoneda}
                onChange={(e) => setCalcMoneda(e.target.value as Moneda)}
                className={`${estiloInput} max-w-44`}
              >
                <option value="USDT">USDT / dólar real</option>
                <option value="BS">Bolívares</option>
                <option value="USD_BCV">Dólares (tasa BCV)</option>
              </select>
            </Campo>
            <div className="flex flex-wrap gap-4 pb-1">
              {destinos.map((d) => (
                <div key={d}>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-sutil">
                    {etiquetaMoneda[d]}
                  </p>
                  <p className="text-base font-semibold text-verde">
                    {hayMonto
                      ? fmt(convertir(monto, calcMoneda, d, tasas, perfil.ajuste), d === 'BS' ? 0 : 2)
                      : '…'}
                  </p>
                </div>
              ))}
            </div>
          </div>
          {hayMonto && (
            <p className="mt-1 text-xs text-sutil">
              {calcMoneda === 'USD_BCV'
                ? `Un precio de $${fmt(monto)} a tasa BCV te cuesta ${fmt(convertir(monto, 'USD_BCV', 'USDT', tasas, perfil.ajuste))} USDT reales: te ahorras $${fmt(monto - convertir(monto, 'USD_BCV', 'USDT', tasas, perfil.ajuste))} por la brecha.`
                : calcMoneda === 'USDT'
                  ? `Vendiendo a tu tasa estimada de ${fmt(binanceEfectiva(tasas, perfil.ajuste))} Bs por dólar.`
                  : `A tu tasa estimada de ${fmt(binanceEfectiva(tasas, perfil.ajuste))} Bs por USDT.`}
            </p>
          )}
        </div>
      </details>
    </header>
  );
}

function Chip({ etiqueta, valor, color = '' }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div className="flex min-w-24 flex-col">
      <span className="text-[10px] font-medium uppercase tracking-wide text-sutil">{etiqueta}</span>
      <span className={`text-base font-semibold ${color}`}>{valor}</span>
    </div>
  );
}
