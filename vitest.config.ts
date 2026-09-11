import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "winix-control-sdk": fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,mjs}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
});
