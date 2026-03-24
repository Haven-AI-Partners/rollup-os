"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Phone, Trash2 } from "lucide-react";
import { createBrokerContact, deleteBrokerContact } from "@/lib/actions/brokers";

interface Contact {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
}

interface ContactListProps {
  firmId: string;
  portcoSlug: string;
  initialContacts: Contact[];
}

export function ContactList({ firmId, portcoSlug, initialContacts }: ContactListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setLoading(true);
    try {
      await createBrokerContact(firmId, portcoSlug, {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        title: title.trim() || undefined,
      });
      setFullName("");
      setEmail("");
      setPhone("");
      setTitle("");
      setShowAdd(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(contactId: string) {
    await deleteBrokerContact(contactId, portcoSlug, firmId);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Contacts</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {initialContacts.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {initialContacts.map((contact) => (
          <div key={contact.id} className="flex items-start gap-2 rounded-md border p-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{contact.fullName}</p>
              {contact.title && (
                <p className="text-xs text-muted-foreground">{contact.title}</p>
              )}
              <div className="mt-1 flex flex-col gap-0.5">
                {contact.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <Mail className="size-2.5 shrink-0" />
                    {contact.email}
                  </p>
                )}
                {contact.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="size-2.5 shrink-0" />
                    {contact.phone}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => handleDelete(contact.id)}
              title="Delete contact"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        {showAdd ? (
          <form onSubmit={handleCreate} className="space-y-2 rounded-md border p-2">
            <Input
              placeholder="Full name *"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading || !fullName.trim()}>
                {loading ? "Adding..." : "Add"}
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
          >
            <Plus className="size-3 mr-1" />
            Add Contact
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
