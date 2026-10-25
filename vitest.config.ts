import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the server-side libraries. The suffix is `.vitest.ts` so the
// three `node:test` parser suites (`*.test.ts`, run by `npm run test:parsers`)
// keep their own runner untouched.
export default defineConfig({
  resolve: {
    // tsconfig.json maps "@/*" to "./*".
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
  },
  test: {
    environment: "node",
    include: ["app/**/*.vitest.ts"],
    restoreMocks: true,
    unstubEnvs: true,
  },
});
