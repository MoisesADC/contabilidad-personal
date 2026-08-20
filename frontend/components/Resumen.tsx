'use client';

import type { AppData } from '@/app/page';
import { costoUSDT, fmt, mesActual, nombreMes } from '@/lib/finanzas';
import { Barra, Tarjeta } from '@/components/ui';

const PALETA = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#64748b'];

export default function Resumen({ app }: { app: AppData }) {
  const { tasas, perfil, categorias, deudas, metas, movimientos } = app;
  const c = (monto: number, moneda: Parameters<typeof costoUSDT>[1]) =>
    costoUSDT(monto, moneda, tasas, perfil.ajuste);

  const gastado = movimientos.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.costoUsdt, 0);
  const deudaTotal = deudas.reduce((s, d) => s + c(d.saldo, d.moneda), 0);
  const ahorrado = metas.reduce((s, m) => s + m.ahorrado, 0);

  // Gastos por categoría (para presupuesto y dona)
  const porCategoria = new Map<string, number>();
  for (const m of movimientos.filter((x) => x.tipo === 'gasto')) {
    const clave = m.metaId ? '__metas' : m.deudaId ? '__deudas' : (m.categoriaId ?? '__otros');
    porCategoria.set(clave, (porCategoria.get(clave) ?? 0) + m.costoUsdt);
  }
  const nombreDe = (clave: string) =>
    clave === '__metas' ? 'Aportes a metas'
    : clave === '__deudas' ? 'Abonos a deudas'
    : clave === '__otros' ? 'Sin categoría'
    : (categorias.find((x) => x.id === clave)?.nombre ?? 'Sin categoría');

  const proximos = deudas
    .filter((d) => d.saldo > 0 && d.proxima)
    .sort((a, b) => (a.proxima! < b.proxima! ? -1 : 1));

  const totalPlan = categorias.reduce((s, cat) => s + c(cat.monto, cat.moneda), 0);
  const esMesActual = app.mes === mesActual();

  return (
    <div className="flex flex-col gap-4">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaDato etiqueta="Disponible del mes" valor={'$' + fmt(perfil.income - gastado)} color="text-verde" nota={`de tu ingreso de $${fmt(perfil.income, 0)}`} />
        <TarjetaDato etiqueta="Gastado este mes" valor={'$' + fmt(gastado)} nota="en USDT reales" />
        <TarjetaDato etiqueta="Deuda total restante" valor={'$' + fmt(deudaTotal)} color="text-rojo" nota={`${deudas.filter((d) => d.saldo > 0).length} deudas activas`} />
        <TarjetaDato etiqueta="Ahorrado en metas" valor={'$' + fmt(ahorrado, 0)} color="text-primario" nota={`${metas.length} metas activas`} />
      </div>

      {/* Presupuesto */}
      <section aria-label="Presupuesto del mes">
        <h2 className="mb-2 text-sm font-semibold">
          Presupuesto <span className="font-normal text-sutil">· {nombreMes(app.mes)}</span>
        </h2>
        <Tarjeta className="flex flex-col gap-3 !p-4">
          {categorias.length === 0 && (
            <p className="text-sm text-sutil">Crea tus categorías de presupuesto en Ajustes.</p>
          )}
          {categorias.map((cat) => {
            const plan = c(cat.monto, cat.moneda);
            const usado = porCategoria.get(cat.id) ?? 0;
            const pct = plan > 0 ? (usado / plan) * 100 : 0;
            return (
              <div key={cat.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>
                    {cat.nombre}
                    {cat.moneda === 'USD_BCV' && (
                      <span className="ml-1.5 rounded-full border border-borde px-1.5 py-px text-[10px] text-ambar">BCV</span>
                    )}
                  </span>
                  <span className="text-sutil">
                    ${fmt(usado)} <span className="text-xs">/ ${fmt(plan)}</span>
                  </span>
                </div>
                <Barra pct={pct} color={pct >= 100 ? 'var(--color-rojo)' : pct > 90 ? 'var(--color-ambar)' : 'var(--color-verde)'} />
              </div>
            );
          })}
          {categorias.length > 0 && (
            <p className="border-t border-borde pt-2 text-right text-sm">
              Plan total <b>${fmt(totalPlan)}</b> · Gastado <b>${fmt(gastado)}</b> ·{' '}
              <b className={perfil.income - gastado < 0 ? 'text-rojo' : 'text-verde'}>
                ${fmt(perfil.income - gastado)}
              </b>{' '}
              <span className="text-sutil">libres</span>
            </p>
          )}
        </Tarjeta>
      </section>

      {/* Próximos pagos */}
      {proximos.length > 0 && esMesActual && (
        <section aria-label="Próximos pagos">
          <h2 className="mb-2 text-sm font-semibold">Próximos pagos</h2>
          <Tarjeta className="divide-y divide-borde !p-0">
            {proximos.map((d) => {
              const cuota = Math.min(d.cuota || d.saldo, d.saldo);
              const vencido = d.proxima! < new Date().toISOString().slice(0, 10);
              return (
                <div key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{d.nombre}</p>
                    <p className={`text-xs ${vencido ? 'text-rojo' : 'text-sutil'}`}>
                      {d.proxima} {vencido && '· vencido'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${fmt(cuota)}</p>
                    <p className="text-xs text-verde">≈ ${fmt(c(cuota, d.moneda))} USDT</p>
                  </div>
                </div>
              );
            })}
          </Tarjeta>
        </section>
      )}

      {/* Estadísticas: dona por categoría */}
      <section aria-label="Gastos por categoría">
        <h2 className="mb-2 text-sm font-semibold">¿En qué se va el dinero?</h2>
        <Tarjeta className="flex flex-wrap items-center gap-6">
          <Dona datos={[...porCategoria.entries()].map(([k, v]) => ({ nombre: nombreDe(k), valor: v }))} total={gastado} />
        </Tarjeta>
      </section>
    </div>
  );
}

function TarjetaDato({ etiqueta, valor, nota, color = '' }: { etiqueta: string; valor: string; nota: string; color?: string }) {
  return (
    <Tarjeta>
      <p className="text-[10px] font-medium uppercase tracking-wide text-sutil">{etiqueta}</p>
      <p className={`mt-0.5 text-xl font-bold sm:text-2xl ${color}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-sutil">{nota}</p>
    </Tarjeta>
  );
}

function Dona({ datos, total }: { datos: { nombre: string; valor: number }[]; total: number }) {
  const orden = [...datos].sort((a, b) => b.valor - a.valor);
  if (total <= 0)
    return <p className="text-sm text-sutil">Cuando registres gastos este mes, aquí verás el desglose.</p>;
  const R = 60;
  const C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <>
      <svg viewBox="0 0 160 160" className="size-40 shrink-0" role="img" aria-label="Gráfico de gastos por categoría">
        {orden.map((d, i) => {
          const frac = d.valor / total;
          const el = (
            <circle
              key={d.nombre}
              cx={80}
              cy={80}
              r={R}
              fill="none"
              stroke={PALETA[i % PALETA.length]}
              strokeWidth={26}
              strokeDasharray={`${frac * C} ${C}`}
              strokeDashoffset={-acumulado * C}
              transform="rotate(-90 80 80)"
            />
          );
          acumulado += frac;
          return el;
        })}
        <text x={80} y={77} textAnchor="middle" className="fill-texto text-[17px] font-bold">
          ${fmt(total, 0)}
        </text>
        <text x={80} y={94} textAnchor="middle" className="fill-sutil text-[10px]">
          total USDT
        </text>
      </svg>
      <ul className="min-w-48 flex-1 text-sm">
        {orden.map((d, i) => (
          <li key={d.nombre} className="flex items-center gap-2 py-1">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: PALETA[i % PALETA.length] }} aria-hidden />
            <span className="truncate">{d.nombre}</span>
            <b className="ml-auto">${fmt(d.valor)}</b>
            <span className="w-11 text-right text-xs text-sutil">{fmt((d.valor / total) * 100, 1)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}
