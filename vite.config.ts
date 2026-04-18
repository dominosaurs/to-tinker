import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        lib: {
            entry: 'src/extension.ts',
            fileName: 'extension',
            formats: ['cjs'],
        },
        outDir: 'dist',
        rolldownOptions: {
            external: ['vscode', 'node:child_process', 'node:fs', 'node:path'],
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: 'shiki-core',
                            test: /@shikijs\/core|\/shiki\//,
                        },
                        {
                            name: 'shiki-langs',
                            test: /@shikijs\/langs/,
                        },
                        {
                            name: 'shiki-themes',
                            test: /@shikijs\/themes/,
                        },
                        {
                            name: 'result-view-vendor',
                            test: /\/node_modules\/(?:preact|preact-render-to-string)\//,
                        },
                    ],
                },
            },
        },
        sourcemap: false,
        target: 'node20',
    },
})
