/**
 * Shared UI constants: icon mappings, label records, and color functions.
 * Centralizes duplicated lookup tables from across components.
 */

import {
  Mail,
  MailOpen,
  Phone,
  Users,
  FileText,
  Send,
  AlertTriangle,
  ShieldAlert,
  Info,
  Zap,
  Circle,
  Clock,
  Check,
  CheckCircle,
} from "lucide-react";

// ── Interaction Types ──

export const INTERACTION_TYPES = [
  "email_sent",
  "email_received",
  "im_requested",
  "call",
  "meeting",
  "form_submitted",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_TYPE_ICONS: Record<InteractionType, typeof Mail> = {
  email_sent: Send,
  email_received: MailOpen,
  im_requested: FileText,
  call: Phone,
  meeting: Users,
  form_submitted: FileText,
};

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  email_sent: "Email Sent",
  email_received: "Email Received",
  im_requested: "IM Requested",
  call: "Call",
  meeting: "Meeting",
  form_submitted: "Form Submitted",
};

// ── Red Flag Severity Icons ──

export const SEVERITY_ICONS: Record<string, typeof AlertTriangle> = {
  critical: ShieldAlert,
  serious: AlertTriangle,
  moderate: Zap,
  info_gap: Info,
};

// ── Task Status Icons ──

export const TASK_STATUS_ICONS: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  blocked: AlertTriangle,
  completed: Check,
};

// ── Org Chart Role Badge Colors ──

export const ROLE_BADGE_COLORS: Record<string, string> = {
  executive: "bg-purple-100 text-purple-800 border-purple-200",
  management: "bg-blue-100 text-blue-800 border-blue-200",
  staff: "bg-gray-100 text-gray-800 border-gray-200",
  board: "bg-amber-100 text-amber-800 border-amber-200",
  advisor: "bg-teal-100 text-teal-800 border-teal-200",
  contractor: "bg-orange-100 text-orange-800 border-orange-200",
};

// ── Eval Badge Color Functions ──

export function stdDevBadgeColor(value: number): string {
  if (value <= 0.2) return "bg-green-50 text-green-700 border-green-200";
  if (value <= 0.5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export function flagAgreementBadgeColor(value: number): string {
  if (value >= 0.7) return "bg-green-50 text-green-700 border-green-200";
  if (value >= 0.4) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

// ── File Type Labels ──

export const FILE_TYPE_LABELS: Record<string, string> = {
  im_pdf: "IM",
  report: "Report",
  attachment: "Attachment",
  nda: "NDA",
  dd_financial: "DD Financial",
  dd_legal: "DD Legal",
  dd_operational: "DD Operational",
  dd_tax: "DD Tax",
  dd_hr: "DD HR",
  dd_it: "DD IT",
  loi: "LOI",
  purchase_agreement: "Purchase Agreement",
  pmi_plan: "PMI Plan",
  pmi_report: "PMI Report",
  other: "Other",
};

// ── Processing Status Icons ──

export const PROCESSING_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; colorClass: string }> = {
  completed: { icon: CheckCircle, colorClass: "text-green-600" },
  failed: { icon: AlertTriangle, colorClass: "text-red-600" },
  processing: { icon: Clock, colorClass: "text-blue-600" },
  pending: { icon: Clock, colorClass: "text-muted-foreground" },
};
