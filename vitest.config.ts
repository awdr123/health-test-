import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/lib/prisma", replacement: path.resolve(__dirname, "tests/prisma.mock.ts") },
      { find: "@", replacement: path.resolve(__dirname, ".") }
    ]
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    env: { DATABASE_URL: "file:./test.db?connection_limit=1" },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "lib/health.ts",
        "lib/validation.ts",
        "app/api/progress/route.ts",
        "app/api/assessment/route.ts",
        "app/api/result/route.ts",
        "app/api/pay/route.ts"
      ],
      thresholds: { lines: 80 }
    }
  }
});
