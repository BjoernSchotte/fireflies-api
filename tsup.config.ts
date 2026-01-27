import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

function addShebang() {
  const files = ['dist/cli/index.js', 'dist/cli/index.cjs'];
  const shebang = '#!/usr/bin/env node\n';
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      if (!content.startsWith('#!')) {
        writeFileSync(file, shebang + content);
      }
    } catch {
      // File might not exist yet
    }
  }
}

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli/index.ts',
    'src/middleware/express.ts',
    'src/middleware/fastify.ts',
    'src/middleware/hono.ts',
    'src/schemas/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['express', 'fastify', 'hono', 'zod'],
  async onSuccess() {
    addShebang();
  },
});
