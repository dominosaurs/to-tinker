import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        emptyOutDir: false,
        outDir: '../../out/result-view-preview',
    },
    root: 'dev/result-view',
})
