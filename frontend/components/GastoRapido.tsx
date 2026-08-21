'use client';

import { useEffect, useState } from 'react';
import type { AppData } from '@/app/page';
import { api, type Moneda } from '@/lib/api';
import { costoUSDT, etiquetaMoneda, fmt, hoy } from '@/lib/finanzas';
import { Boton, Campo, Modal, estiloInput, useToast } from '@/components/ui';

// La moneda que más usa cada quien se recuerda en el dispositivo:
// en la calle casi siempre es bolívares, pero no se le impone a nadie.
const ultimaMoneda = {
  get: (): Moneda =>
    (typeof window === 'undefined'
      ? 'BS'
      : ((localStorage.getItem('moneda_rapida') as Moneda) ?? 'BS')),
  set: (m: Moneda) => localStorage.setItem('moneda_rapida', m),
};

export default function GastoRapido({
  app,
  abierto,
  categoriaInicial,
  onCerrar,
}: {
  app: AppData;
  abierto: boolean;
  categoriaInicial?: string;
  onCerrar: () => void;
}) {
  const toast = useToast();
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('BS');
  const [categoriaId, setCategoriaId] = useState('');
  const [desc, setDesc] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Al abrir: monto en blanco, categoría sugerida y última moneda usada
  useEffect(() => {
    if (!abierto) return;
    setMonto('');
    setDesc('');
    setMoneda(ultimaMoneda.get());
    setCategoriaId(categoriaInicial ?? app.categorias.find((c) => c.tipo === 'diario')?.id ?? '');
  }, [abierto, categoriaInicial, app.categorias]);

  const n = parseFloat(monto) || 0;
  const enUsdt = n > 0 ? costoUSDT(n, moneda, app.tasas, app.perfil.ajuste) : 0;
  // Diarias primero: son las que se registran a diario
  const ordenadas = [...app.categorias].sort((a, b) =>
    a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre) : a.tipo === 'diario' ? -1 : 1,
  );

  async function guardar() {
    if (n <= 0) return toast('Escribe el monto', true);
    setGuardando(true);
    try {
      const cat = app.categorias.find((c) => c.id === categoriaId);
      await api.movimientos.create({
        fecha: hoy(),
        descripcion: desc.trim() || cat?.nombre || 'Gasto del día',
        categoriaId: categoriaId || undefined,
        monto: n,
        moneda,
        tipo: 'gasto',
      });
      ultimaMoneda.set(moneda);
      onCerrar();
      await app.recargar();
      toast(`Anotado: ${fmt(n)} ${etiquetaMoneda[moneda]} = $${fmt(enUsdt)} USDT`);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal abierto={abierto} titulo="Gasto rápido" onCerrar={onCerrar}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Campo etiqueta="¿Cuánto gastaste?">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            autoFocus
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className={`${estiloInput} !text-2xl !font-bold`}
          />
        </Campo>

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-panel2 p-1">
          {(['BS', 'USD_BCV', 'USDT'] as Moneda[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMoneda(m)}
              aria-pressed={moneda === m}
              className={`cursor-pointer rounded-md py-2 text-sm font-semibold transition-colors ${
                moneda === m ? 'bg-primario-fuerte text-white' : 'text-sutil hover:text-texto'
              }`}
            >
              {m === 'BS' ? 'Bolívares' : m === 'USD_BCV' ? '$ BCV' : 'USDT'}
            </button>
          ))}
        </div>

        {n > 0 && moneda !== 'USDT' && (
          <p className="-mt-1 text-xs text-sutil">
            Te cuesta <b className="text-verde">${fmt(enUsdt)} USDT</b> reales
          </p>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-sutil">Categoría</p>
          <div className="flex flex-wrap gap-1.5">
            {ordenadas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaId(c.id)}
                aria-pressed={categoriaId === c.id}
                className={`min-h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors ${
                  categoriaId === c.id
                    ? 'border-primario bg-primario-fuerte text-white'
                    : 'border-borde text-sutil hover:text-texto'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        <Campo etiqueta="Nota (opcional)">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ej: mercado de la esquina"
            className={estiloInput}
          />
        </Campo>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="verde" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Anotar gasto'}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
