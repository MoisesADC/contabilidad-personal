import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// Import explícito del driver: TypeORM lo carga con require dinámico y el
// empaquetador (esbuild) no puede seguirlo. Importándolo aquí queda dentro
// del bundle y se lo pasamos con `driver`.
import * as pgDriver from 'pg';
import { Categoria, Deuda, Meta, Movimiento, Perfil } from './entities';
import { TasasController, TasasService } from './tasas';
import {
  CategoriasController,
  DeudasController,
  MetasController,
  MovimientosController,
  PerfilController,
} from './finanzas';

const ENTIDADES = [Perfil, Categoria, Deuda, Meta, Movimiento];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        driver: pgDriver,
        url: config.get<string>('DATABASE_URL'),
        entities: ENTIDADES,
        synchronize: false, // el esquema se crea con sql/backend-schema.sql
        ssl: { rejectUnauthorized: false }, // requerido por Supabase
      }),
    }),
    TypeOrmModule.forFeature(ENTIDADES),
  ],
  controllers: [
    TasasController,
    PerfilController,
    CategoriasController,
    DeudasController,
    MetasController,
    MovimientosController,
  ],
  providers: [TasasService],
})
export class AppModule {}
