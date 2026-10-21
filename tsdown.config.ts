import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts", "src/constants.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    platform: "neutral",
    target: "es2020",
    outDir: "dist",
});
