// Adaptador para correr NestJS como función serverless en Vercel.
// Arranca la app una sola vez por instancia y reutiliza la conexión.
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');
const express = require('express');
const { AppModule } = require('../dist/app.module');

let cachedServer = null;

module.exports = async (req, res) => {
  try {
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
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        errorArranque: String((e && e.message) || e),
        tipo: e && e.constructor && e.constructor.name,
      }),
    );
  }
};
