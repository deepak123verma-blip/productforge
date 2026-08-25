import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Money property tests run 10,000 cases; give them room.
    testTimeout: 60_000,
  },
});
