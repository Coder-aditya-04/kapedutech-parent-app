import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the API routes and lib helpers. Prisma and outbound fetches
// are mocked per test, so the suite needs no database and no network.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
