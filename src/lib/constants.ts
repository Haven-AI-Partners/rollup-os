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
  FolderOpen,
  FileSpreadsheet,
  Presentation,
  Image,
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

// ── File Type Badge Colors ──

export const FILE_TYPE_BADGE_COLORS: Record<string, string> = {
  im_pdf: "bg-blue-100 text-blue-700 border-blue-200",
  dd_financial: "bg-emerald-100 text-emerald-700 border-emerald-200",
  dd_legal: "bg-purple-100 text-purple-700 border-purple-200",
  dd_operational: "bg-orange-100 text-orange-700 border-orange-200",
  dd_tax: "bg-amber-100 text-amber-700 border-amber-200",
  dd_hr: "bg-pink-100 text-pink-700 border-pink-200",
  dd_it: "bg-cyan-100 text-cyan-700 border-cyan-200",
  nda: "bg-gray-100 text-gray-600 border-gray-200",
  loi: "bg-indigo-100 text-indigo-700 border-indigo-200",
  purchase_agreement: "bg-violet-100 text-violet-700 border-violet-200",
};

// ── MIME Type Icons ──

export const MIME_TYPE_ICONS: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "application/vnd.google-apps.folder": FolderOpen,
  "application/vnd.google-apps.spreadsheet": FileSpreadsheet,
  "application/vnd.google-apps.presentation": Presentation,
  "application/vnd.google-apps.document": FileText,
  "image/png": Image,
  "image/jpeg": Image,
};

// ── Thesis Node Status ──

export type ThesisStatus = "unknown" | "partial" | "complete" | "risk";

export const THESIS_STATUS_CONFIG: Record<
  ThesisStatus,
  {
    label: string;
    badgeClass: string;
    border: string;
    bg: string;
  }
> = {
  unknown: {
    label: "Unknown",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    border: "#d1d5db",
    bg: "#f9fafb",
  },
  partial: {
    label: "Partial",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    border: "#fbbf24",
    bg: "#fffbeb",
  },
  complete: {
    label: "Complete",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    border: "#22c55e",
    bg: "#f0fdf4",
  },
  risk: {
    label: "Risk",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    border: "#ef4444",
    bg: "#fef2f2",
  },
};

// ── User Role Labels & Colors ──

export const USER_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  analyst: "Analyst",
  viewer: "Viewer",
};

export const USER_ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 border-amber-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  analyst: "bg-green-100 text-green-800 border-green-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200",
};

export const USER_ROLE_DESCRIPTIONS: Record<string, string> = {
  owner:
    "Full access. Can manage all settings, team members, and data across all PortCos.",
  admin: "Can manage team members, settings, and all deal data.",
  analyst:
    "Can view and edit deals, brokers, and analytics. Cannot manage team or settings.",
  viewer: "Read-only access. Can view deals, brokers, and analytics.",
};

// ── Processing Status Icons ──

export const PROCESSING_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; colorClass: string }> = {
  completed: { icon: CheckCircle, colorClass: "text-green-600" },
  failed: { icon: AlertTriangle, colorClass: "text-red-600" },
  processing: { icon: Clock, colorClass: "text-blue-600" },
  pending: { icon: Clock, colorClass: "text-muted-foreground" },
};
