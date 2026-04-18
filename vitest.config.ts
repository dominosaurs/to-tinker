import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            vscode: new URL('./test/vscode.ts', import.meta.url).pathname,
        },
    },
    test: {
        environment: 'node',
        include: ['test/**/*.test.ts'],
        setupFiles: ['test/setup.ts'],
    },
})
