"use server";

import { db } from "@/lib/db";
import {
  brokerFirms,
  brokerContacts,
  brokerInteractions,
} from "@/lib/db/schema";
import { eq, sql, count, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

// ── Broker Firms ──

export async function getBrokerFirms() {
  return db
    .select({
      id: brokerFirms.id,
      name: brokerFirms.name,
      website: brokerFirms.website,
      region: brokerFirms.region,
      specialty: brokerFirms.specialty,
      contactCount: sql<number>`(SELECT count(*) FROM broker_contacts WHERE broker_firm_id = broker_firms.id)`.as("contact_count"),
      interactionCount: sql<number>`(SELECT count(*) FROM broker_interactions bi JOIN broker_contacts bc ON bi.broker_contact_id = bc.id WHERE bc.broker_firm_id = broker_firms.id)`.as("interaction_count"),
      listingUrl: brokerFirms.listingUrl,
      metadata: brokerFirms.metadata,
      createdAt: brokerFirms.createdAt,
    })
    .from(brokerFirms)
    .orderBy(asc(brokerFirms.name));
}

export async function getBrokerFirm(firmId: string) {
  const [firm] = await db
    .select()
    .from(brokerFirms)
    .where(eq(brokerFirms.id, firmId))
    .limit(1);
  return firm ?? null;
}

export async function createBrokerFirm(
  portcoSlug: string,
  data: {
    name: string;
    website?: string;
    region?: string;
    specialty?: string;
  }
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [firm] = await db
    .insert(brokerFirms)
    .values({
      name: data.name,
      website: data.website,
      region: data.region,
      specialty: data.specialty,
    })
    .returning();

  revalidatePath(`/${portcoSlug}/brokers`);
  return firm;
}

export async function updateBrokerFirm(
  firmId: string,
  portcoSlug: string,
  data: Partial<{
    name: string;
    website: string;
    region: string;
    specialty: string;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [updated] = await db
    .update(brokerFirms)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(brokerFirms.id, firmId))
    .returning();

  revalidatePath(`/${portcoSlug}/brokers`);
  revalidatePath(`/${portcoSlug}/brokers/${firmId}`);
  return updated;
}

export async function deleteBrokerFirm(firmId: string, portcoSlug: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // Delete interactions for this firm's contacts, then contacts, then firm
  await db.execute(
    sql`DELETE FROM broker_interactions WHERE broker_contact_id IN (SELECT id FROM broker_contacts WHERE broker_firm_id = ${firmId})`
  );
  await db.delete(brokerContacts).where(eq(brokerContacts.brokerFirmId, firmId));
  await db.delete(brokerFirms).where(eq(brokerFirms.id, firmId));

  revalidatePath(`/${portcoSlug}/brokers`);
}

// ── Broker Contacts ──

export async function getContactsForFirm(firmId: string) {
  return db
    .select()
    .from(brokerContacts)
    .where(eq(brokerContacts.brokerFirmId, firmId))
    .orderBy(asc(brokerContacts.fullName));
}

export async function createBrokerContact(
  firmId: string,
  portcoSlug: string,
  data: {
    fullName: string;
    email?: string;
    phone?: string;
    title?: string;
  }
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [contact] = await db
    .insert(brokerContacts)
    .values({
      brokerFirmId: firmId,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      title: data.title,
    })
    .returning();

  revalidatePath(`/${portcoSlug}/brokers/${firmId}`);
  return contact;
}

export async function updateBrokerContact(
  contactId: string,
  portcoSlug: string,
  firmId: string,
  data: Partial<{
    fullName: string;
    email: string;
    phone: string;
    title: string;
  }>
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [updated] = await db
    .update(brokerContacts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(brokerContacts.id, contactId))
    .returning();

  revalidatePath(`/${portcoSlug}/brokers/${firmId}`);
  return updated;
}

export async function deleteBrokerContact(
  contactId: string,
  portcoSlug: string,
  firmId: string
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await db.delete(brokerInteractions).where(eq(brokerInteractions.brokerContactId, contactId));
  await db.delete(brokerContacts).where(eq(brokerContacts.id, contactId));

  revalidatePath(`/${portcoSlug}/brokers/${firmId}`);
}

// ── Broker Interactions ──

export async function getInteractionsForFirm(firmId: string) {
  return db
    .select({
      id: brokerInteractions.id,
      type: brokerInteractions.type,
      direction: brokerInteractions.direction,
      subject: brokerInteractions.subject,
      body: brokerInteractions.body,
      occurredAt: brokerInteractions.occurredAt,
      contactName: brokerContacts.fullName,
      contactId: brokerContacts.id,
    })
    .from(brokerInteractions)
    .innerJoin(brokerContacts, eq(brokerInteractions.brokerContactId, brokerContacts.id))
    .where(eq(brokerContacts.brokerFirmId, firmId))
    .orderBy(desc(brokerInteractions.occurredAt));
}

export async function createInteraction(
  portcoId: string,
  portcoSlug: string,
  firmId: string,
  data: {
    brokerContactId: string;
    dealId?: string;
    type: "email_sent" | "email_received" | "im_requested" | "call" | "meeting" | "form_submitted";
    direction?: "inbound" | "outbound";
    subject?: string;
    body?: string;
    occurredAt: string;
  }
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const [interaction] = await db
    .insert(brokerInteractions)
    .values({
      brokerContactId: data.brokerContactId,
      dealId: data.dealId || null,
      portcoId,
      type: data.type,
      direction: data.direction,
      subject: data.subject,
      body: data.body,
      occurredAt: new Date(data.occurredAt),
    })
    .returning();

  revalidatePath(`/${portcoSlug}/brokers/${firmId}`);
  return interaction;
}
