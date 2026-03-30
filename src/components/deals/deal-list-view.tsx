"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Star, AlertTriangle, ArrowUpDown } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { DeleteDealButton } from "./delete-deal-button";

interface Deal {
  id: string;
  companyName: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  askingPrice: string | null;
  revenue: string | null;
  ebitda: string | null;
  currency: string | null;
  status: string;
  source: string | null;
  stageId: string;
  aiScore: string | null;
  redFlagCount: number;
  createdAt: Date;
}

interface Stage {
  id: string;
  name: string;
  phase: string;
  color: string | null;
}

type SortField = "companyName" | "industry" | "aiScore" | "revenue" | "ebitda" | "redFlagCount" | "createdAt";
type SortDir = "asc" | "desc";

interface DealListViewProps {
  deals: Deal[];
  stages: Stage[];
  portcoSlug: string;
  userRole?: string | null;
}

export function DealListView({ deals, stages, portcoSlug, userRole }: DealListViewProps) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("aiScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const router = useRouter();
  const canDelete = userRole === "admin" || userRole === "owner";

  const gridCols = canDelete
    ? "grid-cols-[1fr_140px_140px_100px_100px_100px_80px_100px_48px]"
    : "grid-cols-[1fr_140px_140px_100px_100px_100px_80px_100px]";

  const stageMap = useMemo(
    () => new Map(stages.map((s) => [s.id, s])),
    [stages]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return deals
      .filter((d) => {
        if (stageFilter !== "all" && d.stageId !== stageFilter) return false;
        if (!q) return true;
        return (
          d.companyName.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.industry?.toLowerCase().includes(q) ||
          d.location?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        switch (sortField) {
          case "companyName":
            return dir * a.companyName.localeCompare(b.companyName);
          case "industry":
            return dir * (a.industry ?? "").localeCompare(b.industry ?? "");
          case "aiScore":
            return dir * ((Number(a.aiScore) || 0) - (Number(b.aiScore) || 0));
          case "revenue":
            return dir * ((Number(a.revenue) || 0) - (Number(b.revenue) || 0));
          case "ebitda":
            return dir * ((Number(a.ebitda) || 0) - (Number(b.ebitda) || 0));
          case "redFlagCount":
            return dir * (a.redFlagCount - b.redFlagCount);
          case "createdAt":
            return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          default:
            return 0;
        }
      });
  }, [deals, query, stageFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "companyName" || field === "industry" ? "asc" : "desc");
    }
  }

  const sortHeader = (field: SortField, children: React.ReactNode) => {
    const active = sortField === field;
    return (
      <button
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 text-xs font-medium ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {children}
        <ArrowUpDown className={`size-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[140px] sm:w-[180px]">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {filtered.length} deal{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Desktop: table layout */}
      <div className="hidden sm:block rounded-md border">
        {/* Header */}
        <div className={`grid ${gridCols} gap-4 px-4 py-2 border-b bg-muted/50`}>
          {sortHeader("companyName", "Company")}
          {sortHeader("industry", "Industry")}
          <span className="text-xs font-medium text-muted-foreground">Stage</span>
          {sortHeader("aiScore", "Score")}
          {sortHeader("revenue", "Revenue")}
          {sortHeader("ebitda", "EBITDA")}
          {sortHeader("redFlagCount", "Flags")}
          {sortHeader("createdAt", "Created")}
          {canDelete && <span />}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {query || stageFilter !== "all" ? "No deals match your filters." : "No deals yet."}
          </div>
        ) : (
          filtered.map((deal) => {
            const stage = stageMap.get(deal.stageId);
            return (
              <div
                key={deal.id}
                onClick={() => router.push(`/${portcoSlug}/pipeline/${deal.id}/overview`)}
                className={`grid ${gridCols} gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors items-center cursor-pointer`}
              >
                <div className="min-w-0 overflow-hidden">
                  <div className="text-sm font-medium truncate">{deal.companyName}</div>
                  {deal.location && (
                    <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 truncate max-w-[100px]">
                        {deal.location}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {deal.industry ?? "--"}
                </div>
                <div>
                  {stage && (
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={stage.color ? { borderColor: stage.color, color: stage.color } : undefined}
                    >
                      {stage.name}
                    </Badge>
                  )}
                </div>
                <div>
                  {deal.aiScore ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="size-3.5 text-amber-500 fill-amber-500" />
                      {Number(deal.aiScore).toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {deal.revenue ? formatCurrency(deal.revenue, deal.currency) : "--"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {deal.ebitda ? formatCurrency(deal.ebitda, deal.currency) : "--"}
                </div>
                <div>
                  {deal.redFlagCount > 0 ? (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <AlertTriangle className="size-3.5" />
                      {deal.redFlagCount}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDateShort(deal.createdAt)}
                </div>
                {canDelete && (
                  <div>
                    <DeleteDealButton
                      dealId={deal.id}
                      portcoSlug={portcoSlug}
                      companyName={deal.companyName}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground rounded-md border">
            {query || stageFilter !== "all" ? "No deals match your filters." : "No deals yet."}
          </div>
        ) : (
          filtered.map((deal) => {
            const stage = stageMap.get(deal.stageId);
            return (
              <div
                key={deal.id}
                onClick={() => router.push(`/${portcoSlug}/pipeline/${deal.id}/overview`)}
                className="block rounded-md border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{deal.companyName}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {deal.industry && (
                        <span className="text-xs text-muted-foreground truncate">
                          {deal.industry}
                        </span>
                      )}
                      {deal.location && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {deal.location}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {stage && (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0"
                        style={stage.color ? { borderColor: stage.color, color: stage.color } : undefined}
                      >
                        {stage.name}
                      </Badge>
                    )}
                    {canDelete && (
                      <DeleteDealButton
                        dealId={deal.id}
                        portcoSlug={portcoSlug}
                        companyName={deal.companyName}
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {deal.aiScore && (
                    <span className="flex items-center gap-1">
                      <Star className="size-3 text-amber-500 fill-amber-500" />
                      {Number(deal.aiScore).toFixed(1)}
                    </span>
                  )}
                  {deal.revenue && (
                    <span>Rev {formatCurrency(deal.revenue, deal.currency)}</span>
                  )}
                  {deal.ebitda && (
                    <span>EBITDA {formatCurrency(deal.ebitda, deal.currency)}</span>
                  )}
                  {deal.redFlagCount > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertTriangle className="size-3" />
                      {deal.redFlagCount}
                    </span>
                  )}
                  <span>{formatDateShort(deal.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
