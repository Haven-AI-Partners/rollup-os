import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

interface ConfigItem {
  label: string;
  value: string;
  mono?: boolean;
}

interface AgentConfigCardProps {
  items: ConfigItem[];
  badges?: ReactNode;
}

const DEFAULT_BADGES = (
  <div className="flex items-center gap-2">
    <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
    <Badge variant="outline" className="text-muted-foreground">Pipeline Agent</Badge>
  </div>
);

export function AgentConfigCard({ items, badges = DEFAULT_BADGES }: AgentConfigCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Configuration</CardTitle>
          {badges}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between">
              <span className="text-muted-foreground">{item.label}</span>
              <span className={item.mono ? "font-mono" : ""}>{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
