import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
});

export const metadata: Metadata = {
  title: 'Mi Contabilidad',
  description:
    'Tus finanzas en dólares reales: tasas BCV y Binance, deudas, presupuesto y metas.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={plex.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
