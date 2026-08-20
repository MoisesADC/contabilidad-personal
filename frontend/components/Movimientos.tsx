'use client';

import { useMemo, useRef, useState } from 'react';
import type { AppData } from '@/app/page';
import { api, type Moneda } from '@/lib/api';
import { costoUSDT, etiquetaMoneda, fmt, hoy, mesActual, nombreMes } from '@/lib/finanzas';
import { Boton, Campo, Tarjeta, estiloInput, iconos, useToast } from '@/components/ui';

// La clave de IA (Gemini) se guarda solo en este dispositivo
const claveIA = {
  get: () => (typeof window === 'undefined' ? '' : localStorage.getItem('gemini_key') ?? ''),
  set: (v: string) => localStorage.setItem('gemini_key', v),
};
export { claveIA };

export default function Movimientos({ app }: { app: AppData }) {
  const toast = useToast();
  const { categorias, tasas, perfil, movimientos, mes, setMes } = app;
  const [fecha, setFecha] = useState(hoy());
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('USDT');
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto');
  const [ocupado, setOcupado] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const meses = useMemo(() => {
    const set = new Set(movimientos.map((m) => m.fecha.slice(0, 7)));
    set.add(mesActual());
    set.add(mes);
    return [...set].sort().reverse();
  }, [movimientos, mes]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(monto);
    if (!n || n <= 0) return toast('Ingresa un monto válido', true);
    setOcupado(true);
    try {
      await api.movimientos.create({
        fecha,
        descripcion: descripcion.trim() || 'Sin descripción',
        categoriaId: categoriaId || undefined,
        monto: n,
        moneda,
        tipo,
      });
      setMonto('');
      setDescripcion('');
      await app.recargar();
      toast('Movimiento guardado ✓');
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setOcupado(false);
    }
  }

  async function borrar(id: string) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    try {
      await api.movimientos.remove(id);
      await app.recargar();
    } catch (err) {
      toast((err as Error).message, true);
    }
  }

  // ── Dictado por voz (Web Speech API) ───────────────────────────
  function dictar() {
    type SR = { new (): { lang: string; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onend: () => void; onerror: (e: { error: string }) => void; start: () => void; stop: () => void } };
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return toast('Tu navegador no soporta dictado — usa Chrome', true);
    if (grabando) return recRef.current?.stop();
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = 'es-VE';
    rec.onresult = (e) => interpretarVoz(e.results[0][0].transcript);
    rec.onend = () => setGrabando(false);
    rec.onerror = (e) => {
      const msgs: Record<string, string> = {
        'not-allowed': 'Permiso de micrófono denegado — actívalo en el navegador',
        'no-speech': 'No escuché nada — intenta de nuevo',
        network: 'El servicio de voz necesita internet',
      };
      toast(msgs[e.error] ?? 'No se pudo escuchar: ' + e.error, true);
    };
    rec.start();
    setGrabando(true);
  }

  function interpretarVoz(texto: string) {
    const t = texto.toLowerCase();
    const num = t.replace(/\./g, '').match(/(\d+(?:,\d+)?)/);
    if (num) setMonto(num[1].replace(',', '.'));
    setMoneda(/bol[ií]var|\bbs\b/.test(t) ? 'BS' : /bcv/.test(t) ? 'USD_BCV' : 'USDT');
    setTipo(/cobr[eé]|ingreso|me pagaron|recib[íi]/.test(t) ? 'ingreso' : 'gasto');
    setDescripcion(texto);
    const cat = categorias.find((c) => t.includes(c.nombre.toLowerCase()));
    if (cat) setCategoriaId(cat.id);
    toast(num ? `Entendí ${num[1]} — revisa y guarda` : 'No capté el monto, escríbelo', !num);
  }

  // ── Foto / captura con IA (Gemini) ─────────────────────────────
  async function analizarImagen(input: HTMLInputElement) {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    const key = claveIA.get();
    if (!key) return toast('Configura tu clave de Gemini en Ajustes → IA', true);
    toast('Analizando imagen con IA…');
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(archivo);
      });
      const nombres = categorias.map((c) => c.nombre).join(', ');
      const prompt = `Analiza esta imagen (factura, recibo o captura de pago móvil de Venezuela). Responde SOLO un JSON válido sin markdown: {"descripcion":"máx 40 caracteres","monto":numero,"moneda":"BS"|"USD","categoria":"una de: ${nombres}","tipo":"gasto"|"ingreso"}. El monto es el TOTAL. En Bs los montos suelen ser cifras grandes.`;
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=' + encodeURIComponent(key),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ inline_data: { mime_type: archivo.type || 'image/jpeg', data: b64 } }, { text: prompt }] }],
          }),
        },
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      const texto = (json.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('la IA no devolvió datos legibles');
      const r = JSON.parse(m[0]);
      if (r.monto) setMonto(String(r.monto));
      setMoneda(r.moneda === 'BS' ? 'BS' : 'USD_BCV');
      if (r.descripcion) setDescripcion(r.descripcion);
      setTipo(r.tipo === 'ingreso' ? 'ingreso' : 'gasto');
      const cat = categorias.find((c) => c.nombre.toLowerCase() === String(r.categoria ?? '').toLowerCase());
      if (cat) setCategoriaId(cat.id);
      toast(`Detecté ${fmt(r.monto)} ${r.moneda === 'BS' ? 'Bs' : '$'} — revisa y guarda`);
    } catch (err) {
      toast('No se pudo analizar: ' + (err as Error).message, true);
    }
  }

  const nombreCat = (id: string | null, m: { deudaId: string | null; metaId: string | null }) =>
    m.metaId ? 'Meta' : m.deudaId ? 'Deuda' : (categorias.find((c) => c.id === id)?.nombre ?? '—');

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Registrar movimiento">
        <h2 className="mb-2 text-sm font-semibold">Registrar movimiento</h2>
        <Tarjeta className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Boton variante={grabando ? 'peligro' : 'secundario'} onClick={dictar}>
              {iconos.microfono()} {grabando ? 'Escuchando… toca para parar' : 'Dictar por voz'}
            </Boton>
            <Boton variante="secundario" onClick={() => camRef.current?.click()}>
              {iconos.camara()} Tomar foto
            </Boton>
            <Boton variante="secundario" onClick={() => galRef.current?.click()}>
              {iconos.galeria()} Subir captura
            </Boton>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => analizarImagen(e.target)} />
            <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => analizarImagen(e.target)} />
          </div>
          <form onSubmit={guardar} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo etiqueta="Fecha">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={estiloInput} />
            </Campo>
            <Campo etiqueta="Descripción">
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Mercado semanal" className={estiloInput} />
            </Campo>
            <Campo etiqueta="Categoría">
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={estiloInput}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Monto">
              <input type="number" inputMode="decimal" step="any" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" className={estiloInput} />
            </Campo>
            <Campo etiqueta="Moneda">
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} className={estiloInput}>
                <option value="USDT">USDT / dólar real</option>
                <option value="USD_BCV">Dólares tasa BCV</option>
                <option value="BS">Bolívares</option>
              </select>
            </Campo>
            <Campo etiqueta="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as 'gasto' | 'ingreso')} className={estiloInput}>
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </select>
            </Campo>
            <div className="col-span-2 sm:col-span-3">
              <Boton type="submit" variante="verde" disabled={ocupado} className="w-full sm:w-auto">
                {ocupado ? 'Guardando…' : 'Guardar movimiento'}
              </Boton>
              {parseFloat(monto) > 0 && moneda !== 'USDT' && (
                <span className="ml-3 text-xs text-sutil">
                  Costo real: ${fmt(costoUSDT(parseFloat(monto), moneda, tasas, perfil.ajuste))} USDT
                </span>
              )}
            </div>
          </form>
        </Tarjeta>
      </section>

      <section aria-label="Historial de movimientos">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Historial</h2>
          <select value={mes} onChange={(e) => setMes(e.target.value)} className={`${estiloInput} !min-h-9 w-auto !py-1 text-sm`} aria-label="Mes">
            {meses.map((m) => (
              <option key={m} value={m}>{nombreMes(m)}</option>
            ))}
          </select>
        </div>
        <Tarjeta className="divide-y divide-borde !p-0">
          {movimientos.length === 0 && <p className="p-4 text-sm text-sutil">Sin movimientos este mes.</p>}
          {movimientos.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.descripcion}</p>
                <p className="text-xs text-sutil">
                  {m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)} · {nombreCat(m.categoriaId, m)}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${m.tipo === 'ingreso' ? 'text-verde' : ''}`}>
                  {m.tipo === 'ingreso' ? '+' : ''}{fmt(m.monto)} <span className="text-xs font-normal text-sutil">{etiquetaMoneda[m.moneda]}</span>
                </p>
                <p className="text-xs text-sutil">${fmt(m.costoUsdt)} USDT</p>
              </div>
              <button onClick={() => borrar(m.id)} aria-label={`Eliminar ${m.descripcion}`} className="cursor-pointer rounded-lg border border-borde p-2 text-rojo transition-colors hover:bg-rojo/10">
                {iconos.cerrar({ className: 'size-4' })}
              </button>
            </div>
          ))}
        </Tarjeta>
      </section>
    </div>
  );
}
