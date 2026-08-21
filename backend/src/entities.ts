import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

// Moneda en que está expresado un monto:
// USDT = dólar real · USD_BCV = dólares a tasa oficial · BS = bolívares
export type Moneda = 'USDT' | 'USD_BCV' | 'BS';

// Clasificación del gasto de una categoría
export type TipoGasto = 'fijo' | 'diario';

@Entity('app_perfiles')
export class Perfil {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @Column('float', { default: 0 })
  income: number;

  @Column('float', { default: 0.4 })
  ajuste: number;
}

@Entity('app_categorias')
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('text')
  nombre: string;

  @Column('float', { default: 0 })
  monto: number;

  @Column('text', { default: 'USDT' })
  moneda: Moneda;

  // 'fijo' = gasto mensual predecible · 'diario' = gasto variable del día a día
  @Column('text', { default: 'fijo' })
  tipo: TipoGasto;
}

@Entity('app_deudas')
export class Deuda {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('text')
  nombre: string;

  @Column('text', { default: 'USDT' })
  moneda: Moneda;

  @Column('float', { name: 'saldo_inicial' })
  saldoInicial: number;

  @Column('float')
  saldo: number;

  @Column('float', { default: 0 })
  cuota: number;

  @Column('int', { name: 'frec_dias', default: 0 })
  frecDias: number;

  @Column('date', { nullable: true })
  proxima: string | null;
}

@Entity('app_metas')
export class Meta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('text')
  nombre: string;

  @Column('float')
  target: number;

  // Mes objetivo en formato YYYY-MM
  @Column('text', { nullable: true })
  fecha: string | null;
}

@Entity('app_movimientos')
export class Movimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('date')
  fecha: string;

  @Column('text')
  descripcion: string;

  @Column('uuid', { name: 'categoria_id', nullable: true })
  categoriaId: string | null;

  @Column('float')
  monto: number;

  @Column('text')
  moneda: Moneda;

  @Column('text', { default: 'gasto' })
  tipo: 'gasto' | 'ingreso';

  // Costo real en USDT calculado con las tasas del día en que se registró
  @Column('float', { name: 'costo_usdt' })
  costoUsdt: number;

  @Column('uuid', { name: 'deuda_id', nullable: true })
  deudaId: string | null;

  @Column('uuid', { name: 'meta_id', nullable: true })
  metaId: string | null;
}
