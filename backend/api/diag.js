// Diagnóstico quirúrgico: carga las piezas del backend una por una
// y reporta exactamente cuál revienta.
module.exports = async (req, res) => {
  const pasos = [];
  const responder = (extra) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ pasos, ...extra }));
  };
  try {
    const fs = require('fs');
    const path = require('path');
    const distDir = path.join(__dirname, '..', 'dist');
    pasos.push({ paso: 'dist existe', ok: fs.existsSync(distDir), contenido: fs.existsSync(distDir) ? fs.readdirSync(distDir).slice(0, 10) : null });

    require('@nestjs/core');
    pasos.push({ paso: 'nestjs/core', ok: true });

    require('typeorm');
    pasos.push({ paso: 'typeorm', ok: true });

    require('pg');
    pasos.push({ paso: 'pg', ok: true });

    const mod = require('../dist/app.module');
    pasos.push({ paso: 'dist/app.module', ok: true, exporta: Object.keys(mod) });

    responder({ resultado: 'TODO CARGA BIEN — el fallo es al conectar o arrancar Nest' });
  } catch (e) {
    responder({ resultado: 'FALLO', error: String(e && e.message), pila: e && e.stack ? String(e.stack).split('\n').slice(0, 5) : null });
  }
};
