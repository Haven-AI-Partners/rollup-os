import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_krdabzbkhboborjfjztb",
  runtime: "node",
  logLevel: "log",
  maxDuration: 600,
  machine: "small-2x",
  dirs: ["src/trigger"],
});
