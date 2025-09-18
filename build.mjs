import { build } from 'esbuild';

await build({
  platform: 'browser',
  format: 'esm',
  bundle: true,
  minify: false,
  entryPoints: ['src/bundle.js'],
  outfile: 'dist/bundle.js',
  target: 'esnext',
});
