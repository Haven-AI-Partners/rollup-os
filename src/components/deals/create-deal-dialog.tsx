"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createDeal } from "@/lib/actions/deals";

interface CreateDealDialogProps {
  portcoId: string;
  portcoSlug: string;
  stages: Array<{ id: string; name: string }>;
}

export function CreateDealDialog({ portcoId, portcoSlug, stages }: CreateDealDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      await createDeal(portcoId, portcoSlug, {
        companyName: formData.get("companyName") as string,
        description: (formData.get("description") as string) || undefined,
        stageId: formData.get("stageId") as string,
        source: (formData.get("source") as "agent_scraped" | "manual" | "broker_referral") || "manual",
        askingPrice: (formData.get("askingPrice") as string) || undefined,
        revenue: (formData.get("revenue") as string) || undefined,
        ebitda: (formData.get("ebitda") as string) || undefined,
        location: (formData.get("location") as string) || undefined,
        industry: (formData.get("industry") as string) || undefined,
        employeeCount: formData.get("employeeCount")
          ? Number(formData.get("employeeCount"))
          : undefined,
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Add Deal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input id="companyName" name="companyName" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stageId">Pipeline Stage *</Label>
              <Select name="stageId" defaultValue={stages[0]?.id} required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select name="source" defaultValue="manual">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="broker_referral">Broker Referral</SelectItem>
                  <SelectItem value="agent_scraped">Agent Scraped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="askingPrice">Asking Price</Label>
              <Input id="askingPrice" name="askingPrice" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue</Label>
              <Input id="revenue" name="revenue" type="number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ebitda">EBITDA</Label>
              <Input id="ebitda" name="ebitda" type="number" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="employeeCount">Employee Count</Label>
            <Input id="employeeCount" name="employeeCount" type="number" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Deal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
