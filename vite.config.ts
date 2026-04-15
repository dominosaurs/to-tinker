import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/extension.ts",
      formats: ["cjs"],
      fileName: () => "extension.js",
    },
    outDir: "out",
    sourcemap: true,
    rollupOptions: {
      external: ["vscode", "node:child_process", "node:fs", "node:path"],
      output: {
        exports: "named",
      },
    },
    target: "node20",
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
  },
});
