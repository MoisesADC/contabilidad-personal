'use client';

import { useEffect, useState } from 'react';
import type { AppData } from '@/app/page';
import { api, type Deuda, type Moneda } from '@/lib/api';
import { costoUSDT, etiquetaMoneda, fmt, hoy } from '@/lib/finanzas';
import { Barra, Boton, Campo, Modal, Tarjeta, estiloInput, iconos, useToast } from '@/components/ui';

const sumarDias = (f: string, d: number) => {
  const x = new Date(f + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};

export default function Deudas({ app }: { app: AppData }) {
  const toast = useToast();
  const { deudas, tasas, perfil } = app;
  const [modal, setModal] = useState<'normal' | 'cashea' | null>(null);
  const [pagando, setPagando] = useState<Deuda | null>(null);
  const [editando, setEditando] = useState<Deuda | null>(null);

  async function borrar(d: Deuda) {
    if (!confirm(`¿Eliminar la deuda "${d.nombre}"? El historial de abonos se conserva.`)) return;
    try {
      await api.deudas.remove(d.id);
      await app.recargar();
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={() => setModal('normal')}>
          {iconos.mas()} Agregar deuda
        </Boton>
        <Boton variante="secundario" onClick={() => setModal('cashea')}>
          {iconos.mas()} Compra Cashea
        </Boton>
      </div>

      {deudas.length === 0 && (
        <Tarjeta>
          <p className="text-sm text-sutil">No tienes deudas registradas. ¡Bien ahí! Agrega la primera cuando la necesites.</p>
        </Tarjeta>
      )}

      {deudas.map((d) => {
        const pagado = d.saldoInicial - d.saldo;
        const pct = d.saldoInicial > 0 ? (pagado / d.saldoInicial) * 100 : 0;
        const cuotasRestantes = d.cuota > 0 ? Math.ceil(d.saldo / d.cuota) : null;
        return (
          <Tarjeta key={d.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {d.nombre}
                <span className={`ml-2 rounded-full border border-borde px-2 py-px text-[10px] ${d.moneda === 'USDT' ? 'text-verde' : 'text-ambar'}`}>
                  {etiquetaMoneda[d.moneda]}
                </span>
              </p>
              <p className={`font-semibold ${d.saldo === 0 ? 'text-verde' : ''}`}>
                {d.saldo === 0 ? 'Saldada ✓' : `Debe: $${fmt(d.saldo)}`}
              </p>
            </div>
            <Barra pct={pct} />
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-sutil">
              <span>Pagado <b className="text-texto">${fmt(pagado)}</b> de ${fmt(d.saldoInicial)}</span>
              {d.moneda === 'USD_BCV' && d.saldo > 0 && (
                <span>Costo real: <b className="text-verde">${fmt(costoUSDT(d.saldo, d.moneda, tasas, perfil.ajuste))} USDT</b></span>
              )}
              {d.cuota > 0 && (
                <span>Cuota <b className="text-texto">${fmt(d.cuota)}</b>{d.frecDias === 14 ? ' quincenal' : d.frecDias === 7 ? ' semanal' : d.frecDias === 30 ? ' mensual' : ''}</span>
              )}
              {cuotasRestantes && d.saldo > 0 && <span>Faltan <b className="text-texto">{cuotasRestantes}</b> cuotas</span>}
              {d.proxima && d.saldo > 0 && <span>Próximo pago: <b className="text-ambar">{d.proxima}</b></span>}
            </div>
            <div className="mt-3 flex gap-2">
              {d.saldo > 0 && <Boton variante="verde" className="!min-h-9 !text-xs" onClick={() => setPagando(d)}>Registrar abono</Boton>}
              <Boton variante="secundario" className="!min-h-9 !text-xs" onClick={() => setEditando(d)}>Editar</Boton>
              <Boton variante="peligro" className="!min-h-9 !text-xs" onClick={() => borrar(d)}>Eliminar</Boton>
            </div>
          </Tarjeta>
        );
      })}

      <ModalDeuda modo={modal} onCerrar={() => setModal(null)} app={app} />
      <ModalAbono deuda={pagando} onCerrar={() => setPagando(null)} app={app} />
      <ModalEditar deuda={editando} onCerrar={() => setEditando(null)} app={app} />
    </div>
  );
}

function ModalDeuda({ modo, onCerrar, app }: { modo: 'normal' | 'cashea' | null; onCerrar: () => void; app: AppData }) {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [saldo, setSaldo] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USDT');
  const [cuota, setCuota] = useState('');
  const [frec, setFrec] = useState('30');
  const [proxima, setProxima] = useState('');
  const [total, setTotal] = useState('');
  const [inicial, setInicial] = useState('');

  const restanteCashea = (parseFloat(total) || 0) - (parseFloat(inicial) || 0);

  async function guardar() {
    try {
      if (modo === 'cashea') {
        if (!nombre || restanteCashea <= 0) return toast('Revisa nombre, total e inicial', true);
        await api.deudas.create({
          nombre: nombre + ' (Cashea)',
          moneda: 'USD_BCV',
          saldoInicial: restanteCashea,
          cuota: restanteCashea / 3,
          frecDias: 14,
          proxima: proxima || sumarDias(hoy(), 14),
        });
      } else {
        const s = parseFloat(saldo);
        if (!nombre || !s) return toast('Completa nombre y saldo', true);
        await api.deudas.create({
          nombre,
          moneda,
          saldoInicial: s,
          cuota: parseFloat(cuota) || 0,
          frecDias: parseInt(frec) || 0,
          proxima: proxima || undefined,
        });
      }
      onCerrar();
      setNombre(''); setSaldo(''); setCuota(''); setTotal(''); setInicial(''); setProxima('');
      await app.recargar();
      toast('Deuda agregada ✓');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <Modal abierto={modo !== null} titulo={modo === 'cashea' ? 'Compra Cashea' : 'Agregar deuda'} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={estiloInput} placeholder={modo === 'cashea' ? 'Teléfono nuevo' : 'Carro'} />
        </Campo>
        {modo === 'cashea' ? (
          <>
            <Campo etiqueta="Total de la compra ($ BCV)">
              <input type="number" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className={estiloInput} />
            </Campo>
            <Campo etiqueta="Inicial pagada ($ BCV)">
              <input type="number" inputMode="decimal" value={inicial} onChange={(e) => setInicial(e.target.value)} className={estiloInput} />
            </Campo>
            {restanteCashea > 0 && (
              <p className="text-xs text-sutil">
                Quedan <b className="text-texto">${fmt(restanteCashea)}</b> en 3 cuotas quincenales de{' '}
                <b className="text-verde">${fmt(restanteCashea / 3)}</b>
              </p>
            )}
          </>
        ) : (
          <>
            <Campo etiqueta="Saldo pendiente">
              <input type="number" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} className={estiloInput} />
            </Campo>
            <Campo etiqueta="Moneda de la deuda">
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} className={estiloInput}>
                <option value="USDT">USDT / dólar real</option>
                <option value="USD_BCV">Dólares tasa BCV (tiendas)</option>
              </select>
            </Campo>
            <Campo etiqueta="Abono planeado (opcional)">
              <input type="number" inputMode="decimal" value={cuota} onChange={(e) => setCuota(e.target.value)} className={estiloInput} />
            </Campo>
            <Campo etiqueta="Frecuencia">
              <select value={frec} onChange={(e) => setFrec(e.target.value)} className={estiloInput}>
                <option value="30">Mensual</option>
                <option value="14">Quincenal</option>
                <option value="7">Semanal</option>
                <option value="0">Sin fecha fija</option>
              </select>
            </Campo>
          </>
        )}
        <Campo etiqueta="Próximo pago (opcional)">
          <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} className={estiloInput} />
        </Campo>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="verde" onClick={guardar}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

function ModalAbono({ deuda, onCerrar, app }: { deuda: Deuda | null; onCerrar: () => void; app: AppData }) {
  const toast = useToast();
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const n = parseFloat(monto) || 0;

  async function guardar() {
    if (!deuda || n <= 0) return toast('Monto inválido', true);
    try {
      const { deuda: d } = await api.deudas.abonar(deuda.id, { monto: n, fecha });
      onCerrar();
      setMonto('');
      await app.recargar();
      toast(d.saldo === 0 ? '¡Deuda saldada! 🎉' : 'Abono registrado ✓');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <Modal abierto={deuda !== null} titulo={`Registrar abono — ${deuda?.nombre ?? ''}`} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <Campo etiqueta="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={estiloInput} />
        </Campo>
        <Campo etiqueta={`Monto del abono (${deuda ? etiquetaMoneda[deuda.moneda] : ''})`}>
          <input
            type="number" inputMode="decimal" autoFocus
            value={monto || (deuda && deuda.cuota > 0 ? String(Math.min(deuda.cuota, deuda.saldo).toFixed(2)) : '')}
            onChange={(e) => setMonto(e.target.value)}
            className={estiloInput}
          />
        </Campo>
        {deuda && n > 0 && (
          <p className="text-xs text-sutil">
            Costo real: <b className="text-verde">${fmt(costoUSDT(n, deuda.moneda, app.tasas, app.perfil.ajuste))} USDT</b>
            {deuda.moneda === 'USD_BCV' && <> · en Bs: {fmt(n * app.tasas.bcv, 0)}</>}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="verde" onClick={guardar}>Registrar</Boton>
        </div>
      </div>
    </Modal>
  );
}

function ModalEditar({ deuda, onCerrar, app }: { deuda: Deuda | null; onCerrar: () => void; app: AppData }) {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [saldo, setSaldo] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USDT');
  const [cuota, setCuota] = useState('');
  const [frec, setFrec] = useState('30');
  const [proxima, setProxima] = useState('');

  // Cada vez que se abre, se cargan los datos actuales de esa deuda
  useEffect(() => {
    if (!deuda) return;
    setNombre(deuda.nombre);
    setSaldo(String(deuda.saldo));
    setMoneda(deuda.moneda);
    setCuota(deuda.cuota ? String(deuda.cuota) : '');
    setFrec(String(deuda.frecDias ?? 0));
    setProxima(deuda.proxima ?? '');
  }, [deuda]);

  async function guardar() {
    const s = parseFloat(saldo);
    if (!deuda || !nombre.trim() || isNaN(s)) return toast('Revisa el nombre y el saldo', true);
    try {
      await api.deudas.update(deuda.id, {
        nombre: nombre.trim(),
        moneda,
        saldo: s,
        cuota: parseFloat(cuota) || 0,
        frecDias: parseInt(frec) || 0,
        proxima: proxima || undefined,
      });
      onCerrar();
      await app.recargar();
      toast('Deuda actualizada ✓');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  return (
    <Modal abierto={deuda !== null} titulo={`Editar — ${deuda?.nombre ?? ''}`} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={estiloInput} />
        </Campo>
        <Campo etiqueta="Saldo pendiente">
          <input type="number" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} className={estiloInput} />
        </Campo>
        <Campo etiqueta="Moneda de la deuda">
          <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} className={estiloInput}>
            <option value="USDT">USDT / dólar real</option>
            <option value="USD_BCV">Dólares tasa BCV (tiendas)</option>
          </select>
        </Campo>
        <Campo etiqueta="Cuota o abono planeado">
          <input type="number" inputMode="decimal" value={cuota} onChange={(e) => setCuota(e.target.value)} className={estiloInput} />
        </Campo>
        <Campo etiqueta="Frecuencia">
          <select value={frec} onChange={(e) => setFrec(e.target.value)} className={estiloInput}>
            <option value="30">Mensual</option>
            <option value="14">Quincenal</option>
            <option value="7">Semanal</option>
            <option value="0">Sin fecha fija</option>
          </select>
        </Campo>
        <Campo etiqueta="Próximo pago">
          <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} className={estiloInput} />
        </Campo>
        {deuda && parseFloat(saldo) > 0 && moneda === 'USD_BCV' && (
          <p className="text-xs text-sutil">
            Costo real del saldo:{' '}
            <b className="text-verde">
              ${fmt(costoUSDT(parseFloat(saldo), 'USD_BCV', app.tasas, app.perfil.ajuste))} USDT
            </b>
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="verde" onClick={guardar}>Guardar cambios</Boton>
        </div>
      </div>
    </Modal>
  );
}
