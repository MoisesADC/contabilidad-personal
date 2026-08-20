import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { AuthGuard, UserId } from './auth';
import { Categoria, Deuda, Meta, Movimiento, Perfil } from './entities';
import { TasasService } from './tasas';

// ── DTOs (validación de lo que envía el frontend) ────────────────
const MONEDAS = ['USDT', 'USD_BCV', 'BS'];

class PerfilDto {
  @IsNumber() @Min(0) income: number;
  @IsNumber() @Min(0) ajuste: number;
}

class CategoriaDto {
  @IsString() @MinLength(1) nombre: string;
  @IsNumber() @Min(0) monto: number;
  @IsIn(MONEDAS) moneda: 'USDT' | 'USD_BCV' | 'BS';
}

class DeudaDto {
  @IsString() @MinLength(1) nombre: string;
  @IsIn(MONEDAS) moneda: 'USDT' | 'USD_BCV' | 'BS';
  @IsNumber() @Min(0.01) saldoInicial: number;
  @IsOptional() @IsNumber() @Min(0) cuota?: number;
  @IsOptional() @IsInt() @Min(0) frecDias?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) proxima?: string;
}

class AbonoDto {
  @IsNumber() @Min(0.01) monto: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha?: string;
}

class MetaDto {
  @IsString() @MinLength(1) nombre: string;
  @IsNumber() @Min(1) target: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) fecha?: string;
}

class AporteDto {
  @IsNumber() @Min(0.01) monto: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha?: string;
  @IsOptional() @IsString() descripcion?: string;
}

class MovimientoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha: string;
  @IsString() @MinLength(1) descripcion: string;
  @IsOptional() @IsString() categoriaId?: string;
  @IsNumber() @Min(0.01) monto: number;
  @IsIn(MONEDAS) moneda: 'USDT' | 'USD_BCV' | 'BS';
  @IsIn(['gasto', 'ingreso']) tipo: 'gasto' | 'ingreso';
}

const hoy = () => new Date().toISOString().slice(0, 10);
const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

// ── Servicio compartido: costo real en USDT según las tasas del día ──
class CostoHelper {
  static calcular(monto: number, moneda: string, bcv: number, binanceEfectiva: number): number {
    if (moneda === 'USD_BCV') return (monto * bcv) / binanceEfectiva;
    if (moneda === 'BS') return monto / binanceEfectiva;
    return monto;
  }
}

// ── Perfil ───────────────────────────────────────────────────────
@Controller('perfil')
@UseGuards(AuthGuard)
export class PerfilController {
  constructor(@InjectRepository(Perfil) private repo: Repository<Perfil>) {}

  @Get()
  async obtener(@UserId() userId: string) {
    return (
      (await this.repo.findOneBy({ userId })) ?? { userId, income: 0, ajuste: 0.4 }
    );
  }

  @Put()
  async guardar(@UserId() userId: string, @Body() dto: PerfilDto) {
    return this.repo.save({ userId, ...dto });
  }
}

// ── Categorías ───────────────────────────────────────────────────
@Controller('categorias')
@UseGuards(AuthGuard)
export class CategoriasController {
  constructor(@InjectRepository(Categoria) private repo: Repository<Categoria>) {}

  @Get()
  listar(@UserId() userId: string) {
    return this.repo.find({ where: { userId }, order: { nombre: 'ASC' } });
  }

  @Post()
  crear(@UserId() userId: string, @Body() dto: CategoriaDto) {
    return this.repo.save({ userId, ...dto });
  }

  @Put(':id')
  async editar(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CategoriaDto,
  ) {
    const cat = await this.repo.findOneBy({ id, userId });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return this.repo.save({ ...cat, ...dto });
  }

  @Delete(':id')
  async borrar(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.repo.delete({ id, userId });
    return { ok: true };
  }
}

// ── Deudas (incluye abonos) ──────────────────────────────────────
@Controller('deudas')
@UseGuards(AuthGuard)
export class DeudasController {
  constructor(
    @InjectRepository(Deuda) private deudas: Repository<Deuda>,
    @InjectRepository(Movimiento) private movs: Repository<Movimiento>,
    private tasas: TasasService,
  ) {}

  @Get()
  listar(@UserId() userId: string) {
    return this.deudas.find({ where: { userId }, order: { proxima: 'ASC' } });
  }

  @Post()
  crear(@UserId() userId: string, @Body() dto: DeudaDto) {
    return this.deudas.save({
      userId,
      nombre: dto.nombre,
      moneda: dto.moneda,
      saldoInicial: dto.saldoInicial,
      saldo: dto.saldoInicial,
      cuota: dto.cuota ?? 0,
      frecDias: dto.frecDias ?? 0,
      proxima: dto.proxima ?? null,
    });
  }

  // Registra un abono: descuenta saldo, crea el movimiento y corre la próxima fecha
  @Post(':id/abonos')
  async abonar(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AbonoDto,
  ) {
    const deuda = await this.deudas.findOneBy({ id, userId });
    if (!deuda) throw new NotFoundException('Deuda no encontrada');
    const t = await this.tasas.obtener();
    const perfilAjuste = 0.4; // el frontend puede recalcular con el ajuste del perfil
    const binanceEf = t.binance * (1 - perfilAjuste / 100);

    deuda.saldo = Math.max(0, deuda.saldo - dto.monto);
    if (deuda.proxima && deuda.frecDias)
      deuda.proxima = deuda.saldo > 0 ? sumarDias(deuda.proxima, deuda.frecDias) : null;
    await this.deudas.save(deuda);

    const mov = await this.movs.save({
      userId,
      fecha: dto.fecha ?? hoy(),
      descripcion: 'Abono ' + deuda.nombre,
      categoriaId: null,
      monto: dto.monto,
      moneda: deuda.moneda,
      tipo: 'gasto' as const,
      costoUsdt: CostoHelper.calcular(dto.monto, deuda.moneda, t.bcv, binanceEf),
      deudaId: deuda.id,
      metaId: null,
    });
    return { deuda, movimiento: mov };
  }

  @Delete(':id')
  async borrar(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.deudas.delete({ id, userId });
    return { ok: true };
  }
}

// ── Metas (incluye aportes) ──────────────────────────────────────
@Controller('metas')
@UseGuards(AuthGuard)
export class MetasController {
  constructor(
    @InjectRepository(Meta) private metas: Repository<Meta>,
    @InjectRepository(Movimiento) private movs: Repository<Movimiento>,
  ) {}

  @Get()
  async listar(@UserId() userId: string) {
    const metas = await this.metas.find({ where: { userId } });
    const aportes = await this.movs
      .createQueryBuilder('m')
      .select('m.meta_id', 'metaId')
      .addSelect('COALESCE(SUM(m.monto),0)', 'ahorrado')
      .where('m.user_id = :userId AND m.meta_id IS NOT NULL', { userId })
      .groupBy('m.meta_id')
      .getRawMany();
    const porMeta = Object.fromEntries(aportes.map((a) => [a.metaId, Number(a.ahorrado)]));
    return metas.map((m) => ({ ...m, ahorrado: porMeta[m.id] ?? 0 }));
  }

  @Post()
  crear(@UserId() userId: string, @Body() dto: MetaDto) {
    return this.metas.save({ userId, ...dto, fecha: dto.fecha ?? null });
  }

  @Post(':id/aportes')
  async aportar(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AporteDto,
  ) {
    const meta = await this.metas.findOneBy({ id, userId });
    if (!meta) throw new NotFoundException('Meta no encontrada');
    return this.movs.save({
      userId,
      fecha: dto.fecha ?? hoy(),
      descripcion: dto.descripcion || 'Aporte ' + meta.nombre,
      categoriaId: null,
      monto: dto.monto,
      moneda: 'USDT' as const,
      tipo: 'gasto' as const,
      costoUsdt: dto.monto,
      deudaId: null,
      metaId: meta.id,
    });
  }

  @Delete(':id')
  async borrar(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.metas.delete({ id, userId });
    return { ok: true };
  }
}

// ── Movimientos ──────────────────────────────────────────────────
@Controller('movimientos')
@UseGuards(AuthGuard)
export class MovimientosController {
  constructor(
    @InjectRepository(Movimiento) private movs: Repository<Movimiento>,
    @InjectRepository(Deuda) private deudas: Repository<Deuda>,
    private tasas: TasasService,
  ) {}

  // ?mes=2026-08 filtra por mes
  @Get()
  listar(@UserId() userId: string, @Query('mes') mes?: string) {
    const qb = this.movs
      .createQueryBuilder('m')
      .where('m.user_id = :userId', { userId })
      .orderBy('m.fecha', 'DESC');
    if (mes && /^\d{4}-\d{2}$/.test(mes))
      qb.andWhere("to_char(m.fecha, 'YYYY-MM') = :mes", { mes });
    return qb.getMany();
  }

  @Post()
  async crear(@UserId() userId: string, @Body() dto: MovimientoDto) {
    const t = await this.tasas.obtener();
    const binanceEf = t.binance * (1 - 0.4 / 100);
    return this.movs.save({
      userId,
      ...dto,
      categoriaId: dto.categoriaId ?? null,
      costoUsdt: CostoHelper.calcular(dto.monto, dto.moneda, t.bcv, binanceEf),
      deudaId: null,
      metaId: null,
    });
  }

  // Al borrar un abono, devuelve el monto al saldo de la deuda
  @Delete(':id')
  async borrar(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const mov = await this.movs.findOneBy({ id, userId });
    if (!mov) throw new NotFoundException('Movimiento no encontrado');
    if (mov.deudaId) {
      const deuda = await this.deudas.findOneBy({ id: mov.deudaId, userId });
      if (deuda) {
        deuda.saldo += mov.monto;
        await this.deudas.save(deuda);
      }
    }
    await this.movs.delete({ id, userId });
    return { ok: true };
  }
}
