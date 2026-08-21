// Punto de entrada serverless: arranca Nest una vez y atiende peticiones.
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');
const express = require('express');
const { AppModule } = require('./dist/app.module');

let cachedServer = null;

async function arrancar() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  app.enableCors({ origin: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return server;
}

module.exports = async (req, res) => {
  try {
    if (!cachedServer) {
      const t0 = Date.now();
      cachedServer = await arrancar();
      console.log('Nest arrancó en', Date.now() - t0, 'ms');
    }
    return cachedServer(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ errorArranque: String((e && e.message) || e) }));
  }
};
