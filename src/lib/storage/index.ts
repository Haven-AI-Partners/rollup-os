import { createClient } from "@supabase/supabase-js";

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for file storage.",
    );
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

const BUCKET = "translated-files";

/**
 * Upload a translated file to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadTranslatedFile(
  portcoId: string,
  fileId: string,
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const client = getStorageClient();
  const path = `${portcoId}/${fileId}/${fileName}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload translated file: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
}
