// Adaptador para correr NestJS como función serverless en Vercel.
// Arranca la app una sola vez por instancia y reutiliza la conexión.
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');
const express = require('express');
const { AppModule } = require('../dist/app.module');

let cachedServer = null;

module.exports = async (req, res) => {
  if (!cachedServer) {
    const server = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
      logger: ['error', 'warn'],
    });
    app.enableCors({ origin: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    cachedServer = server;
  }
  return cachedServer(req, res);
};
