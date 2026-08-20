'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ── Botón ────────────────────────────────────────────────────────
export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'peligro' | 'verde';
}) {
  const estilos = {
    primario: 'bg-primario-fuerte hover:bg-primario text-white',
    verde: 'bg-verde-oscuro hover:bg-verde text-white',
    secundario: 'bg-panel2 hover:bg-panel border border-borde text-texto',
    peligro: 'bg-transparent border border-borde text-rojo hover:bg-rojo/10',
  }[variante];
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${estilos} ${className}`}
    />
  );
}

// ── Tarjeta ──────────────────────────────────────────────────────
export function Tarjeta({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-xl border border-borde bg-panel p-4 ${className}`}
    />
  );
}

// ── Campo de formulario ──────────────────────────────────────────
export function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-sutil">
      {etiqueta}
      {children}
    </label>
  );
}

export const estiloInput =
  'min-h-11 w-full rounded-lg border border-borde bg-panel2 px-3 py-2 text-base text-texto placeholder:text-sutil/60 focus:border-primario focus:outline-none';

// ── Barra de progreso ────────────────────────────────────────────
export function Barra({
  pct,
  color = 'var(--color-verde)',
}: {
  pct: number;
  color?: string;
}) {
  return (
    <div
      className="mt-2 h-2.5 overflow-hidden rounded-full bg-panel2"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────
export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      className="m-auto w-[92%] max-w-md rounded-xl border border-borde bg-panel p-5 text-texto backdrop:bg-black/60"
    >
      <h3 className="mb-3 text-base font-semibold">{titulo}</h3>
      {abierto && children}
    </dialog>
  );
}

// ── Toast (avisos) ───────────────────────────────────────────────
const ToastCtx = createContext<(msg: string, esError?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrar = useCallback((msg: string, esError = false) => {
    setToast({ msg, error: esError });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
        {toast && (
          <div
            className={`max-w-md rounded-full px-5 py-2.5 text-center text-sm font-semibold shadow-lg ${
              toast.error ? 'bg-ambar text-black' : 'bg-verde-oscuro text-white'
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

// ── Iconos SVG (trazo, 24px, sin emojis) ─────────────────────────
function Icono({ d, ...props }: React.SVGProps<SVGSVGElement> & { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5 shrink-0"
      {...props}
    >
      <path d={d} />
    </svg>
  );
}

export const iconos = {
  resumen: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" {...p} />
  ),
  movimientos: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M7 7h13m0 0l-4-4m4 4l-4 4M17 17H4m0 0l4 4m-4-4l4-4" {...p} />
  ),
  deudas: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M3 8h18v11H3zM3 8l2-4h14l2 4M8 13h4" {...p} />
  ),
  metas: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-3.5v-1" {...p} />
  ),
  ajustes: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5L9.1 5.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2L9.5 21h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" {...p} />
  ),
  actualizar: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" {...p} />
  ),
  mas: (p?: React.SVGProps<SVGSVGElement>) => <Icono d="M12 5v14M5 12h14" {...p} />,
  cerrar: (p?: React.SVGProps<SVGSVGElement>) => <Icono d="M6 6l12 12M18 6L6 18" {...p} />,
  microfono: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm6-3a6 6 0 0 1-12 0M12 18v3m-3 0h6" {...p} />
  ),
  camara: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M4 8h3l2-3h6l2 3h3v11H4zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" {...p} />
  ),
  galeria: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4M9 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" {...p} />
  ),
  salir: (p?: React.SVGProps<SVGSVGElement>) => (
    <Icono d="M15 4h5v16h-5M11 8l4 4-4 4m4-4H3" {...p} />
  ),
};
