import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // CLAUDE.md Definition of Done: "≥80% coverage on new files".
      // Scope coverage to Phase 2 new library files that have dedicated unit
      // tests. Integration-heavy files (scheduler, oauth-state, supabase
      // service client) are tracked as Phase 3 tech debt (see
      // specs/tasks.md P3-TD-02) and will be added here once their mocks are
      // in place.
      include: ["src/lib/logger.ts", "src/lib/webhooks/**"],
      exclude: [
        "node_modules/",
        ".next/",
        "e2e/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/types/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
