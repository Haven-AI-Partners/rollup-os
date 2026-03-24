import { z } from "zod";

// ── Deal Schemas ──

export const createDealSchema = z.object({
  companyName: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  stageId: z.string().uuid(),
  source: z.enum(["agent_scraped", "manual", "broker_referral"]).optional(),
  askingPrice: z.string().optional(),
  revenue: z.string().optional(),
  ebitda: z.string().optional(),
  location: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  employeeCount: z.number().int().nonnegative().optional(),
});

export const updateDealSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  stageId: z.string().uuid().optional(),
  status: z.enum(["active", "passed", "closed_won", "closed_lost"]).optional(),
  askingPrice: z.string().optional(),
  revenue: z.string().optional(),
  ebitda: z.string().optional(),
  location: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  assignedTo: z.string().uuid().optional(),
  kanbanPosition: z.number().int().nonnegative().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

// ── Task Schemas ──

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.enum([
    "sourcing",
    "evaluation",
    "dd_financial",
    "dd_legal",
    "dd_operational",
    "dd_tax",
    "dd_hr",
    "dd_it",
    "closing",
    "pmi_integration",
    "pmi_reporting",
    "other",
  ]),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  parentTaskId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "blocked", "completed"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

// ── Red Flag Schemas ──

export const addRedFlagSchema = z.object({
  flagId: z.string().min(1),
  severity: z.enum(["critical", "serious", "moderate", "info_gap"]),
  category: z.string().min(1),
  notes: z.string().optional(),
});

// ── Broker Schemas ──

export const createBrokerFirmSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().url().optional(),
  region: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
});

export const updateBrokerFirmSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  website: z.string().url().optional(),
  region: z.string().max(200).optional(),
  specialty: z.string().max(200).optional(),
});

export const createBrokerContactSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  title: z.string().max(200).optional(),
});

export const createInteractionSchema = z.object({
  brokerContactId: z.string().uuid(),
  dealId: z.string().uuid().optional(),
  type: z.enum(["email_sent", "email_received", "im_requested", "call", "meeting", "form_submitted"]),
  direction: z.enum(["inbound", "outbound"]).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(10000).optional(),
  occurredAt: z.string(),
});

// ── Financial Schemas ──

export const addFinancialEntrySchema = z.object({
  period: z.string().min(1),
  periodType: z.enum(["monthly", "quarterly", "annual", "snapshot"]),
  revenue: z.string().optional(),
  ebitda: z.string().optional(),
  netIncome: z.string().optional(),
  ebitdaMarginPct: z.string().optional(),
});
