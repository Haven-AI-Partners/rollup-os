import { getBrokerFirms } from "@/lib/actions/brokers";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, MessageSquare, Globe, MapPin, DollarSign, BarChart3 } from "lucide-react";
import Link from "next/link";
import { CreateBrokerFirmDialog } from "@/components/brokers/create-firm-dialog";

export default async function BrokersPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const firms = await getBrokerFirms();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brokers</h1>
          <p className="text-sm text-muted-foreground">
            {firms.length} broker firm{firms.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <CreateBrokerFirmDialog portcoSlug={portcoSlug} />
      </div>

      {firms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {firms.map((firm) => {
            const meta = (firm.metadata ?? {}) as Record<string, string | undefined>;
            return (
              <Link key={firm.id} href={`/${portcoSlug}/brokers/${firm.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-md bg-muted p-2">
                        <Building2 className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{firm.name}</p>
                        {meta.type && (
                          <p className="text-xs text-muted-foreground">{meta.type}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {firm.region && (
                            <Badge variant="outline" className="text-[10px]">
                              <MapPin className="mr-0.5 size-2.5" />
                              {firm.region}
                            </Badge>
                          )}
                          {firm.specialty && (
                            <Badge variant="secondary" className="text-[10px]">
                              {firm.specialty}
                            </Badge>
                          )}
                        </div>

                        {meta.relevance && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2 border-l-2 border-primary/30 pl-2">
                            {meta.relevance}
                          </p>
                        )}

                        {(meta.avgDealSize || meta.dealFlow) && (
                          <div className="mt-2 space-y-1">
                            {meta.avgDealSize && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <DollarSign className="size-2.5 shrink-0" />
                                {meta.avgDealSize}
                              </p>
                            )}
                            {meta.dealFlow && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <BarChart3 className="size-2.5 shrink-0" />
                                {meta.dealFlow}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {firm.contactCount} contact{Number(firm.contactCount) !== 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="size-3" />
                            {firm.interactionCount} interaction{Number(firm.interactionCount) !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {firm.website && (
                          <p className="mt-1 text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Globe className="size-3 shrink-0" />
                            {firm.website}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No broker firms yet. Add one to start tracking broker relationships.
          </p>
        </div>
      )}
    </div>
  );
}
