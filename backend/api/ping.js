// Diagnóstico: confirma que las funciones corren y qué configuración ven.
// No expone valores, solo si existen.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      ok: true,
      version: 'diag-2',
      node: process.version,
      tiene_DATABASE_URL: Boolean(process.env.DATABASE_URL),
      tiene_SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      variables_visibles: Object.keys(process.env).filter((k) =>
        /SUPA|DATABASE/i.test(k),
      ),
    }),
  );
};
