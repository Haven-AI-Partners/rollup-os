"use server";

import { db } from "@/lib/db";
import {
  brokerFirms,
  brokerContacts,
  brokerInteractions,
} from "@/lib/db/schema";
import { eq, asc, desc, count, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import {
  createBrokerFirmSchema,
  updateBrokerFirmSchema,
  createBrokerContactSchema,
  createInteractionSchema,
} from "@/lib/actions/schemas";

// ── Broker Firms ──

export async function getBrokerFirms() {
  await requireAuth();

  // Fetch all firms
  const firms = await db
    .select({
      id: brokerFirms.id,
      name: brokerFirms.name,
      website: brokerFirms.website,
      region: brokerFirms.region,
      specialty: brokerFirms.specialty,
      listingUrl: brokerFirms.listingUrl,
      metadata: brokerFirms.metadata,
      createdAt: brokerFirms.createdAt,
    })
    .from(brokerFirms)
    .orderBy(asc(brokerFirms.name));

  if (firms.length === 0) return [];

  // Fetch contact counts and interaction counts in parallel
  const [contactCounts, interactionCounts] = await Promise.all([
    db
      .select({
        brokerFirmId: brokerContacts.brokerFirmId,
        count: count(brokerContacts.id),
      })
      .from(brokerContacts)
      .groupBy(brokerContacts.brokerFirmId),
    db
      .select({
        brokerFirmId: brokerContacts.brokerFirmId,
        count: count(brokerInteractions.id),
      })
      .from(brokerInteractions)
      .innerJoin(brokerContacts, eq(brokerInteractions.brokerContactId, brokerContacts.id))
      .groupBy(brokerContacts.brokerFirmId),
  ]);

  const contactMap = new Map(contactCounts.map((c) => [c.brokerFirmId, Number(c.count)]));
  const interactionMap = new Map(interactionCounts.map((i) => [i.brokerFirmId, Number(i.count)]));

  return firms.map((firm) => ({
    ...firm,
    contactCount: contactMap.get(firm.id) ?? 0,
    interactionCount: interactionMap.get(firm.id) ?? 0,
  }));
}

export async function getBrokerFirm(firmId: string) {
  await requireAuth();
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
  await requireAuth();

  const validated = createBrokerFirmSchema.parse(data);

  const [firm] = await db
    .insert(brokerFirms)
    .values({
      name: validated.name,
      website: validated.website,
      region: validated.region,
      specialty: validated.specialty,
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
  await requireAuth();

  const validated = updateBrokerFirmSchema.parse(data);

  const [updated] = await db
    .update(brokerFirms)
    .set({ ...validated, updatedAt: new Date() })
    .where(eq(brokerFirms.id, firmId))
    .returning();

  revalidatePath(`/${portcoSlug}/brokers`);
  revalidatePath(`/${portcoSlug}/brokers/${firmId}`);
  return updated;
}

export async function deleteBrokerFirm(firmId: string, portcoSlug: string) {
  await requireAuth();

  // Delete interactions for this firm's contacts, then contacts, then firm
  const contactIds = await db
    .select({ id: brokerContacts.id })
    .from(brokerContacts)
    .where(eq(brokerContacts.brokerFirmId, firmId));
  if (contactIds.length > 0) {
    await db
      .delete(brokerInteractions)
      .where(inArray(brokerInteractions.brokerContactId, contactIds.map((c) => c.id)));
  }
  await db.delete(brokerContacts).where(eq(brokerContacts.brokerFirmId, firmId));
  await db.delete(brokerFirms).where(eq(brokerFirms.id, firmId));

  revalidatePath(`/${portcoSlug}/brokers`);
}

// ── Broker Contacts ──

export async function getContactsForFirm(firmId: string) {
  await requireAuth();
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
  await requireAuth();

  const validated = createBrokerContactSchema.parse(data);

  const [contact] = await db
    .insert(brokerContacts)
    .values({
      brokerFirmId: firmId,
      fullName: validated.fullName,
      email: validated.email,
      phone: validated.phone,
      title: validated.title,
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
  await requireAuth();

  const validated = createBrokerContactSchema.partial().parse(data);

  const [updated] = await db
    .update(brokerContacts)
    .set({ ...validated, updatedAt: new Date() })
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
  await requireAuth();

  await db.delete(brokerInteractions).where(eq(brokerInteractions.brokerContactId, contactId));
  await db.delete(brokerContacts).where(eq(brokerContacts.id, contactId));

  revalidatePath(`/${portcoSlug}/brokers/${firmId}`);
}

// ── Broker Interactions ──

export async function getInteractionsForFirm(firmId: string) {
  await requireAuth();
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
  await requireAuth();

  const validated = createInteractionSchema.parse(data);

  const [interaction] = await db
    .insert(brokerInteractions)
    .values({
      brokerContactId: validated.brokerContactId,
      dealId: validated.dealId || null,
      portcoId,
      type: validated.type,
      direction: validated.direction,
      subject: validated.subject,
      body: validated.body,
      occurredAt: new Date(validated.occurredAt),
    })
    .returning();

  revalidatePath(`/${portcoSlug}/brokers/${firmId}`);
  return interaction;
}
