import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        lib: {
            entry: 'src/extension.ts',
            fileName: 'extension.js',
            formats: ['cjs'],
        },
        rolldownOptions: {
            external: ['vscode', 'node:child_process', 'node:fs', 'node:path'],
        },
        sourcemap: false,
        target: 'node20',
    },
})
