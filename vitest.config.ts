import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({test:{environment:"node",setupFiles:["./tests/setup.ts"],exclude:["tests/live/**","node_modules/**",".next/**"]},resolve:{alias:{"@":path.resolve(__dirname,"src")}}});
