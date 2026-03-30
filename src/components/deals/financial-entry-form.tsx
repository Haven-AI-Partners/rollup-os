"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ChevronUp } from "lucide-react";
import { addFinancialEntry } from "@/lib/actions/financials";

interface FinancialEntryFormProps {
  dealId: string;
  portcoId: string;
  portcoSlug: string;
}

export function FinancialEntryForm({ dealId, portcoId, portcoSlug }: FinancialEntryFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("");
  const [periodType, setPeriodType] = useState<string>("annual");
  const [revenue, setRevenue] = useState("");
  const [ebitda, setEbitda] = useState("");
  const [netIncome, setNetIncome] = useState("");
  const [ebitdaMarginPct, setEbitdaMarginPct] = useState("");
  const openForm = useCallback(() => setOpen(true), []);
  const closeForm = useCallback(() => setOpen(false), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!period.trim()) return;
    setLoading(true);
    try {
      await addFinancialEntry(dealId, portcoId, portcoSlug, {
        period: period.trim(),
        periodType: periodType as "monthly" | "quarterly" | "annual" | "snapshot",
        revenue: revenue || undefined,
        ebitda: ebitda || undefined,
        netIncome: netIncome || undefined,
        ebitdaMarginPct: ebitdaMarginPct || undefined,
      });
      setPeriod("");
      setRevenue("");
      setEbitda("");
      setNetIncome("");
      setEbitdaMarginPct("");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={openForm}>
        <Plus className="mr-1 size-3.5" />
        Add Financial Period
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">New Financial Period</p>
        <Button type="button" variant="ghost" size="icon" onClick={closeForm}>
          <ChevronUp className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Period (e.g. FY2024, Q3 2024)"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          required
        />
        <Select value={periodType} onValueChange={setPeriodType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="snapshot">Snapshot</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          placeholder="Revenue"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
        />
        <Input
          type="number"
          placeholder="EBITDA"
          value={ebitda}
          onChange={(e) => setEbitda(e.target.value)}
        />
        <Input
          type="number"
          placeholder="Net Income"
          value={netIncome}
          onChange={(e) => setNetIncome(e.target.value)}
        />
        <Input
          type="number"
          placeholder="EBITDA Margin %"
          value={ebitdaMarginPct}
          onChange={(e) => setEbitdaMarginPct(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={loading || !period.trim()}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
