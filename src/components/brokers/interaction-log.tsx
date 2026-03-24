"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import {
  INTERACTION_TYPE_ICONS,
  INTERACTION_TYPE_LABELS,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { InteractionForm } from "./interaction-form";

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

export function InteractionLog({
  firmId,
  portcoId,
  portcoSlug,
  contacts,
  initialInteractions,
}: InteractionLogProps) {
  const [showAdd, setShowAdd] = useState(false);

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
          <InteractionForm
            firmId={firmId}
            portcoId={portcoId}
            portcoSlug={portcoSlug}
            contacts={contacts}
            onClose={() => setShowAdd(false)}
          />
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
              const Icon = INTERACTION_TYPE_ICONS[interaction.type as keyof typeof INTERACTION_TYPE_ICONS] ?? Mail;
              const DirectionIcon = interaction.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={interaction.id} className="relative flex gap-3 py-2">
                  <div className="relative z-10 mt-0.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted">
                    <Icon className="size-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {INTERACTION_TYPE_LABELS[interaction.type as keyof typeof INTERACTION_TYPE_LABELS] ?? interaction.type}
                      </Badge>
                      {interaction.direction && (
                        <DirectionIcon className="size-3 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {interaction.contactName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(interaction.occurredAt)}
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
