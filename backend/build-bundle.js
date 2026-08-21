// Empaqueta el backend compilado (dist/) en UN solo archivo para arranque
// rápido en serverless (Vercel). Los módulos opcionales que Nest/TypeORM
// intentan cargar y no existen se marcan como externos.
const esbuild = require('esbuild');
const path = require('path');

const ignorarFaltantes = {
  name: 'ignorar-faltantes',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.path.startsWith('.') || args.path.startsWith('/')) return null; // relativos: normal
      try {
        require.resolve(args.path, { paths: [args.resolveDir || __dirname] });
        return null; // existe: empaquetar
      } catch {
        return { path: args.path, external: true }; // no existe: dejar externo
      }
    });
  },
};

esbuild
  .build({
    entryPoints: [path.join(__dirname, 'serverless-entry.js')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: path.join(__dirname, 'dist', 'bundle.js'),
    plugins: [ignorarFaltantes],
    logLevel: 'warning',
    minify: false,
    sourcemap: false,
  })
  .then(() => console.log('bundle listo: dist/bundle.js'))
  .catch((e) => { console.error(e); process.exit(1); });
