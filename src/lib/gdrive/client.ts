import { drive, auth } from "googleapis/build/src/apis/drive";
import { db } from "@/lib/db";
import { portcos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "./crypto";
import { withRateLimit } from "./rate-limit";

function getOAuthClient() {
  return new auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/** Generate the OAuth authorization URL for a portco */
export function getAuthUrl(portcoSlug: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.readonly"],
    state: portcoSlug,
  });
}

/** Exchange auth code for tokens and store the refresh token */
export async function handleCallback(code: string, portcoSlug: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("No refresh token received. Re-authorize with prompt=consent.");
  }

  const { encrypt } = await import("./crypto");
  const encryptedToken = encrypt(tokens.refresh_token);

  await db
    .update(portcos)
    .set({
      gdriveServiceAccountEnc: encryptedToken,
      updatedAt: new Date(),
    })
    .where(eq(portcos.slug, portcoSlug));

  return tokens;
}

/** Get an authenticated Drive client for a portco */
export async function getDriveClient(portcoId: string) {
  const [portco] = await db
    .select({
      gdriveTokenEnc: portcos.gdriveServiceAccountEnc,
      gdriveFolderId: portcos.gdriveFolderId,
    })
    .from(portcos)
    .where(eq(portcos.id, portcoId))
    .limit(1);

  if (!portco?.gdriveTokenEnc) {
    return null;
  }

  const refreshToken = decrypt(portco.gdriveTokenEnc);
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  const driveClient = drive({ version: "v3", auth: client });
  return { drive: driveClient, folderId: portco.gdriveFolderId };
}

/** Get the email of the connected Google account */
export async function getConnectedAccount(portcoId: string) {
  const result = await getDriveClient(portcoId);
  if (!result) return null;

  const { drive } = result;
  const res = await withRateLimit(
    () => drive.about.get({ fields: "user(emailAddress, displayName)" }),
    "about.get",
  );
  return {
    email: res.data.user?.emailAddress ?? null,
    displayName: res.data.user?.displayName ?? null,
  };
}

/** Get folder name by ID */
export async function getFolderName(portcoId: string, folderId: string) {
  const result = await getDriveClient(portcoId);
  if (!result) return null;

  const { drive } = result;
  const res = await withRateLimit(
    () => drive.files.get({ fileId: folderId, fields: "name" }),
    `files.get folder=${folderId}`,
  );
  return res.data.name ?? null;
}

/** List files in the portco's GDrive folder */
export async function listFiles(portcoId: string, pageSize = 50, pageToken?: string) {
  const result = await getDriveClient(portcoId);
  if (!result) return null;

  const { drive, folderId } = result;
  const query = folderId ? `'${folderId}' in parents and trashed = false` : "trashed = false";

  const res = await withRateLimit(
    () => drive.files.list({
      q: query,
      pageSize,
      pageToken,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)",
      orderBy: "modifiedTime desc",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    }),
    `files.list folder=${folderId ?? "root"}`,
  );

  return {
    files: res.data.files ?? [],
    nextPageToken: res.data.nextPageToken,
  };
}

/** Download file content as a buffer */
export async function downloadFile(portcoId: string, fileId: string) {
  const result = await getDriveClient(portcoId);
  if (!result) return null;

  const { drive } = result;
  const res = await withRateLimit(
    () => drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    ),
    `files.get media=${fileId}`,
  );

  return Buffer.from(res.data as ArrayBuffer);
}
