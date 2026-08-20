'use client';

import { useState } from 'react';
import type { AppData } from '@/app/page';
import { api, type Meta } from '@/lib/api';
import { fmt, hoy } from '@/lib/finanzas';
import { Barra, Boton, Campo, Modal, Tarjeta, estiloInput, iconos, useToast } from '@/components/ui';

const COLORES = ['#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

export default function Metas({ app }: { app: AppData }) {
  const toast = useToast();
  const [creando, setCreando] = useState(false);
  const [aportando, setAportando] = useState<Meta | null>(null);

  async function borrar(m: Meta) {
    if (!confirm(`¿Eliminar la meta "${m.nombre}"? Los aportes quedan en el historial.`)) return;
    try {
      await api.metas.remove(m.id);
      await app.recargar();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Boton variante="secundario" className="self-start" onClick={() => setCreando(true)}>
        {iconos.mas()} Nueva meta
      </Boton>

      {app.metas.length === 0 && (
        <Tarjeta>
          <p className="text-sm text-sutil">
            Crea tu primera meta: boda, viaje, fondo de emergencia, un teléfono nuevo… Guarda tus
            aportes en USDT, nunca en bolívares.
          </p>
        </Tarjeta>
      )}

      {app.metas.map((m, i) => {
        const color = COLORES[i % COLORES.length];
        const pct = (m.ahorrado / m.target) * 100;
        let proyeccion = '';
        if (m.fecha) {
          const [y, mm] = m.fecha.split('-').map(Number);
          const ahora = new Date();
          const mesesFaltan = Math.max(0, (y - ahora.getFullYear()) * 12 + (mm - 1 - ahora.getMonth()));
          proyeccion =
            mesesFaltan > 0
              ? `Faltan ${mesesFaltan} meses → ahorra $${fmt(Math.max(0, (m.target - m.ahorrado) / mesesFaltan), 0)}/mes`
              : m.ahorrado >= m.target
                ? '¡Meta cumplida! 🎉'
                : `Fecha cumplida — faltan $${fmt(m.target - m.ahorrado, 0)}`;
        }
        return (
          <Tarjeta key={m.id}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{m.nombre}</p>
              <p className="font-semibold" style={{ color }}>
                ${fmt(m.ahorrado, 0)} <span className="text-xs font-normal text-sutil">/ ${fmt(m.target, 0)} · {fmt(pct, 0)}%</span>
              </p>
            </div>
            <Barra pct={pct} color={color} />
            {proyeccion && <p className="mt-2 text-xs text-sutil">{proyeccion}</p>}
            <div className="mt-3 flex gap-2">
              <Boton variante="verde" className="!min-h-9 !text-xs" onClick={() => setAportando(m)}>
                {iconos.mas({ className: 'size-4' })} Aporte
              </Boton>
              <Boton variante="peligro" className="!min-h-9 !text-xs" onClick={() => borrar(m)}>Eliminar</Boton>
            </div>
          </Tarjeta>
        );
      })}

      <ModalMeta abierto={creando} onCerrar={() => setCreando(false)} app={app} />
      <ModalAporte meta={aportando} onCerrar={() => setAportando(null)} app={app} />
    </div>
  );
}

function ModalMeta({ abierto, onCerrar, app }: { abierto: boolean; onCerrar: () => void; app: AppData }) {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [target, setTarget] = useState('');
  const [fecha, setFecha] = useState('');

  async function guardar() {
    const t = parseFloat(target);
    if (!nombre || !t) return toast('Completa nombre y meta', true);
    try {
      await api.metas.create({ nombre, target: t, fecha: fecha || undefined });
      onCerrar();
      setNombre(''); setTarget(''); setFecha('');
      await app.recargar();
      toast('Meta creada ✓');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Nueva meta" onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <Campo etiqueta="Nombre (Boda, Viaje, Fondo de emergencia…)">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={estiloInput} />
        </Campo>
        <Campo etiqueta="Meta total (USDT)">
          <input type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={estiloInput} />
        </Campo>
        <Campo etiqueta="Fecha objetivo (opcional)">
          <input type="month" value={fecha} onChange={(e) => setFecha(e.target.value)} className={estiloInput} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="verde" onClick={guardar}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

function ModalAporte({ meta, onCerrar, app }: { meta: Meta | null; onCerrar: () => void; app: AppData }) {
  const toast = useToast();
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoy());

  async function guardar() {
    const n = parseFloat(monto);
    if (!meta || !n || n <= 0) return toast('Monto inválido', true);
    try {
      await api.metas.aportar(meta.id, { monto: n, fecha });
      onCerrar();
      setMonto('');
      await app.recargar();
      toast('Aporte guardado ✓');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <Modal abierto={meta !== null} titulo={`Aporte a ${meta?.nombre ?? ''}`} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <Campo etiqueta="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={estiloInput} />
        </Campo>
        <Campo etiqueta="Monto (USDT)">
          <input type="number" inputMode="decimal" autoFocus value={monto} onChange={(e) => setMonto(e.target.value)} className={estiloInput} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="verde" onClick={guardar}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}
