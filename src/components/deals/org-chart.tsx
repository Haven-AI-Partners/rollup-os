"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { ROLE_BADGE_COLORS } from "@/lib/constants";

interface OrgNode {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  role: string | null;
  children: OrgNode[];
}

interface OrgChartProps {
  roots: OrgNode[];
  orphans: OrgNode[];
}

function OrgNodeCard({ node }: { node: OrgNode }) {
  return (
    <div className="flex flex-col items-center">
      <Card className="px-4 py-3 min-w-[160px] max-w-[220px] text-center">
        <div className="flex flex-col items-center gap-1">
          <div className="rounded-full bg-muted p-1.5">
            <User className="size-3.5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium leading-tight">{node.name}</p>
          {node.title && (
            <p className="text-xs text-muted-foreground leading-tight">{node.title}</p>
          )}
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {node.department && (
              <Badge variant="outline" className="text-[10px]">
                {node.department}
              </Badge>
            )}
            {node.role && (
              <Badge
                variant="outline"
                className={`text-[10px] ${ROLE_BADGE_COLORS[node.role] ?? ""}`}
              >
                {node.role}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {node.children.length > 0 && (
        <>
          {/* Vertical connector down from parent */}
          <div className="w-px h-5 bg-border" />

          {/* Horizontal connector bar across children */}
          {node.children.length > 1 && (
            <div className="relative w-full flex justify-center">
              <div
                className="h-px bg-border absolute top-0"
                style={{
                  left: `${100 / (node.children.length * 2)}%`,
                  right: `${100 / (node.children.length * 2)}%`,
                }}
              />
            </div>
          )}

          {/* Children */}
          <div className="flex gap-6">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-border" />
                <OrgNodeCard node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChart({ roots, orphans }: OrgChartProps) {
  if (roots.length === 0 && orphans.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No organizational structure extracted yet. Process an IM to generate one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {roots.length > 0 && (
        <div className="overflow-x-auto pb-4 -webkit-overflow-scrolling-touch">
          <div className="inline-flex flex-col items-center min-w-full justify-center">
            {roots.map((root) => (
              <OrgNodeCard key={root.id} node={root} />
            ))}
          </div>
        </div>
      )}

      {orphans.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Other Personnel
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {orphans.map((node) => (
              <Card key={node.id} className="px-3 py-2.5 text-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="rounded-full bg-muted p-1.5">
                    <User className="size-3 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium leading-tight">{node.name}</p>
                  {node.title && (
                    <p className="text-xs text-muted-foreground leading-tight">{node.title}</p>
                  )}
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    {node.department && (
                      <Badge variant="outline" className="text-[10px]">
                        {node.department}
                      </Badge>
                    )}
                    {node.role && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${ROLE_BADGE_COLORS[node.role] ?? ""}`}
                      >
                        {node.role}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
