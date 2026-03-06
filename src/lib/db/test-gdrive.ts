import "dotenv/config";
import { listFiles } from "../gdrive/client";

async function main() {
  const result = await listFiles("937e630e-d733-49e2-aeb2-f5d278ea3bfb", 10);
  if (result === null) {
    console.log("No drive client - token missing");
    process.exit(1);
  }
  console.log("Files found:", result.files.length);
  for (const f of result.files.slice(0, 10)) {
    console.log(" ", f.name, "|", f.mimeType);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
