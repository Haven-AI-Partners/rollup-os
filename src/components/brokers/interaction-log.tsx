"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  MailOpen,
  Phone,
  Users,
  FileText,
  Send,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { createInteraction } from "@/lib/actions/brokers";

interface Contact {
  id: string;
  fullName: string;
}

interface Interaction {
  id: string;
  type: string;
  direction: string | null;
  subject: string | null;
  body: string | null;
  occurredAt: Date;
  contactName: string;
  contactId: string;
}

interface InteractionLogProps {
  firmId: string;
  portcoId: string;
  portcoSlug: string;
  contacts: Contact[];
  initialInteractions: Interaction[];
}

const typeIcons: Record<string, typeof Mail> = {
  email_sent: Send,
  email_received: MailOpen,
  im_requested: FileText,
  call: Phone,
  meeting: Users,
  form_submitted: FileText,
};

const typeLabels: Record<string, string> = {
  email_sent: "Email Sent",
  email_received: "Email Received",
  im_requested: "IM Requested",
  call: "Call",
  meeting: "Meeting",
  form_submitted: "Form Submitted",
};

const INTERACTION_TYPES = [
  "email_sent",
  "email_received",
  "im_requested",
  "call",
  "meeting",
  "form_submitted",
] as const;

export function InteractionLog({
  firmId,
  portcoId,
  portcoSlug,
  contacts,
  initialInteractions,
}: InteractionLogProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState("");
  const [type, setType] = useState<string>("email_sent");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId || !type) return;
    setLoading(true);
    try {
      const direction = ["email_sent", "im_requested", "form_submitted"].includes(type)
        ? "outbound" as const
        : ["email_received"].includes(type)
          ? "inbound" as const
          : undefined;

      await createInteraction(portcoId, portcoSlug, firmId, {
        brokerContactId: contactId,
        type: type as typeof INTERACTION_TYPES[number],
        direction,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
        occurredAt,
      });
      setSubject("");
      setBody("");
      setShowAdd(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Interaction Log</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {initialInteractions.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add interaction form */}
        {showAdd ? (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Contact *</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERACTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {typeLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date/Time</Label>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Input
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8 text-xs"
            />
            <Textarea
              placeholder="Notes..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading || !contactId}>
                {loading ? "Logging..." : "Log Interaction"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowAdd(true)}
            disabled={contacts.length === 0}
          >
            <Plus className="size-3 mr-1" />
            {contacts.length === 0 ? "Add a contact first" : "Log Interaction"}
          </Button>
        )}

        {/* Interaction timeline */}
        {initialInteractions.length > 0 ? (
          <div className="relative space-y-0">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            {initialInteractions.map((interaction) => {
              const Icon = typeIcons[interaction.type] ?? Mail;
              const DirectionIcon = interaction.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={interaction.id} className="relative flex gap-3 py-2">
                  <div className="relative z-10 mt-0.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted">
                    <Icon className="size-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {typeLabels[interaction.type] ?? interaction.type}
                      </Badge>
                      {interaction.direction && (
                        <DirectionIcon className="size-3 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {interaction.contactName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(interaction.occurredAt).toLocaleString()}
                      </span>
                    </div>
                    {interaction.subject && (
                      <p className="mt-0.5 text-sm font-medium">{interaction.subject}</p>
                    )}
                    {interaction.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {interaction.body}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No interactions logged yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
