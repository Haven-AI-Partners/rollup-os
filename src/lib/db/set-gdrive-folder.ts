import "dotenv/config";
import { getDriveClient } from "../gdrive/client";

async function main() {
  const result = await getDriveClient("937e630e-d733-49e2-aeb2-f5d278ea3bfb");
  if (!result) { console.log("No drive client"); process.exit(1); }

  const { drive } = result;
  // Find the IMs folder
  const res = await drive.files.list({
    q: "name = 'IMs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id, name)",
  });

  for (const f of res.data.files ?? []) {
    console.log("Found folder:", f.name, "| ID:", f.id);
  }
  process.exit(0);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
