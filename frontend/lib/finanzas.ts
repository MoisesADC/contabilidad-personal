import type { Moneda, Tasas } from './api';

// Tasa Binance efectiva: P2P publicado menos el % de ajuste por venta pequeña
export const binanceEfectiva = (t: Tasas, ajuste: number) =>
  t.binance * (1 - ajuste / 100);

// Costo real en USDT de un monto expresado en cualquier moneda
export function costoUSDT(monto: number, moneda: Moneda, t: Tasas, ajuste: number) {
  const ef = binanceEfectiva(t, ajuste);
  if (moneda === 'USD_BCV') return (monto * t.bcv) / ef;
  if (moneda === 'BS') return monto / ef;
  return monto;
}

// Convierte un monto entre cualquiera de las tres monedas.
// Puente: primero se lleva a USDT (dólar real) y de ahí al destino.
export function convertir(
  monto: number,
  desde: Moneda,
  hacia: Moneda,
  t: Tasas,
  ajuste: number,
) {
  const enUsdt = costoUSDT(monto, desde, t, ajuste);
  const ef = binanceEfectiva(t, ajuste);
  if (hacia === 'USDT') return enUsdt;
  if (hacia === 'BS') return enUsdt * ef;
  return (enUsdt * ef) / t.bcv; // USD_BCV
}

export const fmt = (n: number | null | undefined, dec = 2) =>
  n == null || isNaN(n)
    ? '—'
    : n.toLocaleString('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const hoy = () => new Date().toISOString().slice(0, 10);
export const mesActual = () => hoy().slice(0, 7);

export const etiquetaMoneda: Record<Moneda, string> = {
  USDT: '$ USDT',
  USD_BCV: '$ BCV',
  BS: 'Bs',
};

export const nombreMes = (yyyyMm: string) =>
  new Date(yyyyMm + '-02').toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
