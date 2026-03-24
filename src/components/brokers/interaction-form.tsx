"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInteraction } from "@/lib/actions/brokers";
import { INTERACTION_TYPES, INTERACTION_TYPE_LABELS } from "@/lib/constants";

interface Contact {
  id: string;
  fullName: string;
}

interface InteractionFormProps {
  firmId: string;
  portcoId: string;
  portcoSlug: string;
  contacts: Contact[];
  onClose: () => void;
}

export function InteractionForm({
  firmId,
  portcoId,
  portcoSlug,
  contacts,
  onClose,
}: InteractionFormProps) {
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
        ? ("outbound" as const)
        : ["email_received"].includes(type)
          ? ("inbound" as const)
          : undefined;

      await createInteraction(portcoId, portcoSlug, firmId, {
        brokerContactId: contactId,
        type: type as (typeof INTERACTION_TYPES)[number],
        direction,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
        occurredAt,
      });
      setSubject("");
      setBody("");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
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
                  {INTERACTION_TYPE_LABELS[t]}
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
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
