import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        emptyOutDir: true,
        lib: {
            entry: 'src/extension.ts',
            fileName: () => 'extension.js',
            formats: ['cjs'],
        },
        outDir: 'out',
        rollupOptions: {
            external: ['vscode', 'node:child_process', 'node:fs', 'node:path'],
            output: {
                exports: 'named',
                inlineDynamicImports: true,
            },
        },
        sourcemap: false,
        target: 'node20',
    },
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
        setupFiles: ['test/setup.ts'],
    },
})
