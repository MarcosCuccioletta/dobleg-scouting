import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Los tests de las edge functions importan el assert de Deno por URL, que
      // vitest no resuelve. Se apunta a un shim local con la misma API.
      'https://deno.land/std@0.208.0/assert/mod.ts': path.resolve(
        __dirname,
        './supabase/functions/_shared/deno-assert-shim.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Las edge functions también se testean acá: sus tests eran de Deno, que no
    // está instalado, así que en los hechos no corrían nunca.
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
})
