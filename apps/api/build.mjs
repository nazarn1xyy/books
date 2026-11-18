import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external: ['@node-rs/argon2', 'pino-pretty'],
  // ESM bundles of CJS deps need require():
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
};

await build({
  ...common,
  entryPoints: { server: 'src/server.ts', migrate: 'src/cli/migrate.ts', 'make-admin': 'src/cli/make-admin.ts' },
  outdir: 'dist',
});
console.log('api bundled to dist/');
