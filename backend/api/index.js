// Adaptador para correr NestJS como función serverless en Vercel.
let cachedServer = null;
let ultimoErrorAsync = null;
process.on('unhandledRejection', (e) => { ultimoErrorAsync = e; });
process.on('uncaughtException', (e) => { ultimoErrorAsync = e; });

async function arrancar() {
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
  return server;
}

module.exports = async (req, res) => {
  try {
    if (!cachedServer) {
      const t0 = Date.now();
      cachedServer = await Promise.race([
        arrancar(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Arranque de Nest superó 9s')), 9000)),
      ]);
      console.log('Nest arrancó en', Date.now() - t0, 'ms');
    }
    return cachedServer(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      errorArranque: String((e && e.message) || e),
      errorAsync: ultimoErrorAsync ? String(ultimoErrorAsync.message || ultimoErrorAsync) : null,
      pila: e && e.stack ? String(e.stack).split('\n').slice(0, 6) : null,
    }));
  }
};
