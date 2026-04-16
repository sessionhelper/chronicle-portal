import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/component/**/*.test.tsx"],
    exclude: ["node_modules/**", "tests/e2e/**", ".next/**"],
    setupFiles: ["tests/setup.ts"],
    environmentMatchGlobs: [
      ["tests/component/**", "happy-dom"],
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/components/ui/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
