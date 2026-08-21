// Adaptador para correr NestJS como función serverless en Vercel.
// Todos los require van DENTRO del try para poder reportar cualquier
// fallo de carga (módulo faltante, dist no incluido, etc.).
let cachedServer = null;

module.exports = async (req, res) => {
  try {
    if (!cachedServer) {
      const { NestFactory } = require('@nestjs/core');
      const { ExpressAdapter } = require('@nestjs/platform-express');
      const { ValidationPipe } = require('@nestjs/common');
      const express = require('express');
      const { AppModule } = require('../dist/app.module');

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
        codigo: e && e.code,
        pila: e && e.stack ? String(e.stack).split('\n').slice(0, 4) : null,
      }),
    );
  }
};
