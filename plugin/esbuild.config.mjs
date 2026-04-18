import esbuild from 'esbuild';
import process from 'process';

const isProd = process.argv[2] === 'production';

esbuild
  .build({
    entryPoints: ['main.ts'],
    bundle: true,
    external: [
      'obsidian',
      'electron',
      '@codemirror/*',
      '@lezer/*',
    ],
    format: 'cjs',
    // platform=browser is required for Obsidian mobile (Capacitor WebView)
    platform: 'browser',
    target: 'es2020',
    logLevel: 'info',
    sourcemap: isProd ? false : 'inline',
    treeShaking: true,
    minify: isProd,
    outfile: 'main.js',
    loader: {
      '.md': 'text',
    },
  })
  .catch(() => process.exit(1));
