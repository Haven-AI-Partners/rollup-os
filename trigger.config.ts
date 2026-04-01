import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_krdabzbkhboborjfjztb",
  runtime: "node",
  logLevel: "log",
  maxDuration: 600,
  machine: "small-2x",
  dirs: ["src/trigger"],
  onStart: async () => {
    const required = [
      "DATABASE_URL",
      "GOOGLE_DRIVE_ENCRYPTION_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required env vars for Trigger.dev tasks: ${missing.join(", ")}. ` +
          `Configure them in the Trigger.dev dashboard under Project > Environment > Environment Variables.`,
      );
    }
  },
});
