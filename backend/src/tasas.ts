import { Controller, Get, Injectable } from '@nestjs/common';

// Consulta BCV y Binance P2P desde el servidor, con caché de 5 minutos:
// así la app no depende de que el navegador del usuario alcance las APIs.
export interface Tasas {
  bcv: number;
  paralelo: number | null;
  binance: number;
  updatedAt: string;
}

@Injectable()
export class TasasService {
  private cache: Tasas | null = null;
  private cacheTime = 0;
  private readonly TTL = 5 * 60 * 1000;

  async obtener(): Promise<Tasas> {
    if (this.cache && Date.now() - this.cacheTime < this.TTL) return this.cache;
    const [dolarapi, criptoya] = await Promise.all([
      fetch('https://ve.dolarapi.com/v1/dolares').then((r) => r.json()),
      fetch('https://criptoya.com/api/binancep2p/USDT/VES/1').then((r) => r.json()),
    ]);
    const oficial = dolarapi.find((d: any) => d.fuente === 'oficial');
    const paralelo = dolarapi.find((d: any) => d.fuente === 'paralelo');
    this.cache = {
      bcv: oficial?.promedio ?? 0,
      paralelo: paralelo?.promedio ?? null,
      binance: criptoya?.bid ?? 0,
      updatedAt: new Date().toISOString(),
    };
    this.cacheTime = Date.now();
    return this.cache;
  }
}

@Controller('tasas')
export class TasasController {
  constructor(private readonly tasas: TasasService) {}

  // Público: las tasas no son datos privados
  @Get()
  obtener() {
    return this.tasas.obtener();
  }
}
