import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing CLERK_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created" || type === "user.updated") {
    const email = data.email_addresses[0]?.email_address;
    if (!email) {
      return NextResponse.json({ error: "No email" }, { status: 400 });
    }

    const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

    // Upsert by email first (handles Clerk environment/account changes),
    // then fall back to clerkId conflict for normal updates
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          clerkId: data.id,
          fullName,
          avatarUrl: data.image_url,
          updatedAt: new Date(),
        })
        .where(eq(users.email, email));
    } else {
      await db
        .insert(users)
        .values({
          clerkId: data.id,
          email,
          fullName,
          avatarUrl: data.image_url,
        })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: {
            email,
            fullName,
            avatarUrl: data.image_url,
            updatedAt: new Date(),
          },
        });
    }
  }

  if (type === "user.deleted") {
    await db.delete(users).where(eq(users.clerkId, data.id));
  }

  return NextResponse.json({ success: true });
}
