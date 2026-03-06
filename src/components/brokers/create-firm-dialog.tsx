"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { createBrokerFirm } from "@/lib/actions/brokers";

interface CreateBrokerFirmDialogProps {
  portcoSlug: string;
}

export function CreateBrokerFirmDialog({ portcoSlug }: CreateBrokerFirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [region, setRegion] = useState("");
  const [specialty, setSpecialty] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createBrokerFirm(portcoSlug, {
        name: name.trim(),
        website: website.trim() || undefined,
        region: region.trim() || undefined,
        specialty: specialty.trim() || undefined,
      });
      setName("");
      setWebsite("");
      setRegion("");
      setSpecialty("");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 size-4" />
          Add Broker Firm
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Broker Firm</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Firm Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TRANBI, Batonz..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Japan, Kansai..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. IT Services, SMB..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Firm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
