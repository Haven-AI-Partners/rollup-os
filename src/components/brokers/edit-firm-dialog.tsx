"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { updateBrokerFirm } from "@/lib/actions/brokers";

interface Firm {
  id: string;
  name: string;
  website: string | null;
  region: string | null;
  specialty: string | null;
}

interface EditFirmDialogProps {
  firm: Firm;
  portcoSlug: string;
}

export function EditFirmDialog({ firm, portcoSlug }: EditFirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(firm.name);
  const [website, setWebsite] = useState(firm.website ?? "");
  const [region, setRegion] = useState(firm.region ?? "");
  const [specialty, setSpecialty] = useState(firm.specialty ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateBrokerFirm(firm.id, portcoSlug, {
        name: name.trim(),
        website: website.trim() || undefined,
        region: region.trim() || undefined,
        specialty: specialty.trim() || undefined,
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1 size-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Broker Firm</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the details of this broker firm
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Firm Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-website">Website</Label>
            <Input
              id="edit-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-region">Region</Label>
              <Input
                id="edit-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-specialty">Specialty</Label>
              <Input
                id="edit-specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
