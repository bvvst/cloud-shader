import { defineConfig } from 'tsup'

const shared = { format: ['esm', 'cjs'], dts: true, target: 'es2020', sourcemap: true } as const

export default defineConfig([
  { ...shared, entry: { index: 'src/index.ts' }, clean: true },
  {
    ...shared,
    entry: { react: 'src/react.tsx' },
    external: ['react'],
    // Next.js App Router needs this to treat the component as client-only.
    banner: { js: "'use client'" },
  },
])
