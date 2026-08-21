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

    // Probar la conexión a PostgreSQL con límite de tiempo
    const url = process.env.DATABASE_URL || '';
    const m = url.match(/@([^:/]+):(\d+)\/(\w+)/);
    pasos.push({ paso: 'DATABASE_URL', host: m ? m[1] : null, puerto: m ? m[2] : null, largo: url.length, empiezaBien: url.startsWith('postgresql://') });
    const { Client } = require('pg');
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000 });
    const t0 = Date.now();
    try {
      await client.connect();
      const r = await client.query('select 1 as uno');
      pasos.push({ paso: 'conexion postgres', ok: true, ms: Date.now() - t0, filas: r.rows });
      await client.end();
    } catch (e) {
      pasos.push({ paso: 'conexion postgres', ok: false, ms: Date.now() - t0, error: String(e && e.message), codigo: e && e.code });
    }
    responder({ resultado: 'fin' });
  } catch (e) {
    responder({ resultado: 'FALLO', error: String(e && e.message), pila: e && e.stack ? String(e.stack).split('\n').slice(0, 5) : null });
  }
};
