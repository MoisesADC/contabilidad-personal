'use client';

import { useState } from 'react';
import type { AppData } from '@/app/page';
import { api, type Moneda } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { claveIA } from '@/components/Movimientos';
import { Boton, Campo, Tarjeta, estiloInput, iconos, useToast } from '@/components/ui';

export default function Ajustes({ app }: { app: AppData }) {
  const toast = useToast();
  const { perfil, categorias } = app;
  const [income, setIncome] = useState(String(perfil.income || ''));
  const [ajuste, setAjuste] = useState(String(perfil.ajuste));
  const [gemini, setGemini] = useState(claveIA.get());
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevaMoneda, setNuevaMoneda] = useState<Moneda>('USDT');

  async function guardarPerfil() {
    try {
      await api.perfil.save({ income: parseFloat(income) || 0, ajuste: parseFloat(ajuste) || 0 });
      await app.recargar();
      toast('Perfil guardado ✓');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  async function crearCategoria() {
    if (!nuevaCat.trim()) return toast('Ponle nombre a la categoría', true);
    try {
      await api.categorias.create({ nombre: nuevaCat.trim(), monto: parseFloat(nuevoMonto) || 0, moneda: nuevaMoneda });
      setNuevaCat(''); setNuevoMonto('');
      await app.recargar();
      toast('Categoría creada ✓');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Cuenta">
        <h2 className="mb-2 text-sm font-semibold">Cuenta</h2>
        <Tarjeta className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm">Conectado como <b>{app.email}</b></p>
            <p className="text-xs text-sutil">Tus datos se guardan en tu cuenta y se ven igual en todos tus dispositivos.</p>
          </div>
          <Boton variante="peligro" onClick={() => supabase.auth.signOut()}>
            {iconos.salir({ className: 'size-4' })} Cerrar sesión
          </Boton>
        </Tarjeta>
      </section>

      <section aria-label="Ingreso y tasa">
        <h2 className="mb-2 text-sm font-semibold">Ingreso y tasa real</h2>
        <Tarjeta className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Ingreso mensual (USDT)">
              <input type="number" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} className={estiloInput} />
            </Campo>
            <Campo etiqueta="Ajuste Binance (% por debajo del P2P)">
              <input type="number" inputMode="decimal" step="0.1" value={ajuste} onChange={(e) => setAjuste(e.target.value)} className={estiloInput} />
            </Campo>
          </div>
          <p className="text-xs text-sutil">
            El P2P publicado es para montos grandes; al vender ~$10 te pagan un poco menos. Este % baja
            la tasa para que los cálculos usen lo que de verdad recibes.
          </p>
          <Boton variante="verde" className="self-start" onClick={guardarPerfil}>Guardar</Boton>
        </Tarjeta>
      </section>

      <section aria-label="Categorías de presupuesto">
        <h2 className="mb-2 text-sm font-semibold">Categorías y presupuesto</h2>
        <Tarjeta className="flex flex-col gap-2">
          {categorias.map((c) => (
            <FilaCategoria key={c.id} app={app} id={c.id} nombre={c.nombre} monto={c.monto} moneda={c.moneda} />
          ))}
          <div className="mt-1 grid grid-cols-[1fr_90px_100px_auto] items-end gap-2 border-t border-borde pt-3">
            <Campo etiqueta="Nueva categoría">
              <input value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} placeholder="Nombre" className={estiloInput} />
            </Campo>
            <Campo etiqueta="Plan">
              <input type="number" inputMode="decimal" value={nuevoMonto} onChange={(e) => setNuevoMonto(e.target.value)} placeholder="0" className={estiloInput} />
            </Campo>
            <Campo etiqueta="Moneda">
              <select value={nuevaMoneda} onChange={(e) => setNuevaMoneda(e.target.value as Moneda)} className={estiloInput}>
                <option value="USDT">USDT</option>
                <option value="USD_BCV">USD BCV</option>
              </select>
            </Campo>
            <Boton variante="secundario" onClick={crearCategoria} aria-label="Agregar categoría">
              {iconos.mas()}
            </Boton>
          </div>
        </Tarjeta>
      </section>

      <section aria-label="Inteligencia artificial">
        <h2 className="mb-2 text-sm font-semibold">IA para facturas y capturas</h2>
        <Tarjeta className="flex flex-col gap-3">
          <p className="text-xs text-sutil">
            Con una clave gratuita de Google Gemini (aistudio.google.com/apikey, sin tarjeta), las fotos
            de facturas se analizan solas: monto, moneda y categoría. La clave se guarda solo en este
            dispositivo.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Campo etiqueta="API key de Gemini">
              <input type="password" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder="AQ. o AIza…" className={`${estiloInput} min-w-64`} />
            </Campo>
            <Boton variante="secundario" onClick={() => { claveIA.set(gemini.trim()); toast(gemini.trim() ? 'Clave guardada ✓' : 'Clave borrada'); }}>
              Guardar
            </Boton>
          </div>
        </Tarjeta>
      </section>
    </div>
  );
}

function FilaCategoria({ app, id, nombre, monto, moneda }: { app: AppData; id: string; nombre: string; monto: number; moneda: Moneda }) {
  const toast = useToast();
  const [n, setN] = useState(nombre);
  const [m, setM] = useState(String(monto));
  const [mon, setMon] = useState<Moneda>(moneda);

  async function guardar() {
    if (!n.trim()) return toast('El nombre no puede quedar vacío', true);
    try {
      await api.categorias.update(id, { nombre: n.trim(), monto: parseFloat(m) || 0, moneda: mon });
      await app.recargar();
      toast('Categoría actualizada ✓');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  async function borrar() {
    if (!confirm(`¿Eliminar la categoría "${nombre}"? Sus movimientos quedan sin categoría.`)) return;
    try {
      await api.categorias.remove(id);
      await app.recargar();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  const cambiado = n !== nombre || parseFloat(m) !== monto || mon !== moneda;

  return (
    <div className="grid grid-cols-[1fr_90px_100px_auto] items-center gap-2">
      <input value={n} onChange={(e) => setN(e.target.value)} className={estiloInput} aria-label={`Nombre de ${nombre}`} />
      <input type="number" inputMode="decimal" value={m} onChange={(e) => setM(e.target.value)} className={estiloInput} aria-label={`Plan de ${nombre}`} />
      <select value={mon} onChange={(e) => setMon(e.target.value as Moneda)} className={estiloInput} aria-label={`Moneda de ${nombre}`}>
        <option value="USDT">USDT</option>
        <option value="USD_BCV">USD BCV</option>
      </select>
      <div className="flex gap-1">
        {cambiado && (
          <Boton variante="verde" className="!min-h-9 !px-2.5 !text-xs" onClick={guardar}>✓</Boton>
        )}
        <Boton variante="peligro" className="!min-h-9 !px-2.5" onClick={borrar} aria-label={`Eliminar ${nombre}`}>
          {iconos.cerrar({ className: 'size-4' })}
        </Boton>
      </div>
    </div>
  );
}
