import { notFound } from "next/navigation";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { Building2, Scale, AlertTriangle } from "lucide-react";
import { SCORING_DIMENSIONS } from "@/lib/scoring/rubric";
import { RED_FLAG_DEFINITIONS } from "@/lib/scoring/red-flags";

export default async function CustomizationPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const criticalFlags = RED_FLAG_DEFINITIONS.filter((f) => f.severity === "critical").length;
  const seriousFlags = RED_FLAG_DEFINITIONS.filter((f) => f.severity === "serious" || f.severity === "moderate").length;
  const infoGapFlags = RED_FLAG_DEFINITIONS.filter((f) => f.severity === "info_gap").length;

  return (
    <SettingsPageLayout portcoSlug={portcoSlug} portcoName={portco.name}>
        {/* PortCo Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-5" />
              <div>
                <CardTitle className="text-base">PortCo Profile</CardTitle>
                <CardDescription>Company identity and acquisition criteria</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Name</p>
                <p className="font-medium">{portco.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Slug</p>
                <p className="font-medium font-mono text-xs">{portco.slug}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Industry</p>
                <p className="font-medium">{portco.industry ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Description</p>
                <p className="font-medium">{portco.description ?? "—"}</p>
              </div>
            </div>
            {portco.focusAreas && (portco.focusAreas as string[]).length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Focus Areas</p>
                <div className="flex flex-wrap gap-1">
                  {(portco.focusAreas as string[]).map((area) => (
                    <Badge key={area} variant="outline" className="text-xs">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t">
              Profile editing coming soon.
            </p>
          </CardContent>
        </Card>

        {/* Scoring Rubric */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="size-5" />
                <div>
                  <CardTitle className="text-base">Scoring Rubric</CardTitle>
                  <CardDescription>
                    {SCORING_DIMENSIONS.length} dimensions used to evaluate IMs
                  </CardDescription>
                </div>
              </div>
              <Badge variant={portco.scoringRubric ? "default" : "secondary"}>
                {portco.scoringRubric ? "Custom" : "Default"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SCORING_DIMENSIONS.map((dim) => (
                <div
                  key={dim.name}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{dim.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {dim.description}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 ml-4">
                    {(dim.weight * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
              Custom rubric editing coming soon. Currently using the default rubric.
            </p>
          </CardContent>
        </Card>

        {/* Red Flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              <div>
                <CardTitle className="text-base">Red Flags</CardTitle>
                <CardDescription>
                  Predefined risk indicators flagged during IM analysis
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-3">
              <div className="rounded-lg border p-3 flex-1">
                <p className="text-xs text-red-600 font-medium">Critical</p>
                <p className="text-xl font-semibold">{criticalFlags}</p>
              </div>
              <div className="rounded-lg border p-3 flex-1">
                <p className="text-xs text-amber-600 font-medium">Serious / Moderate</p>
                <p className="text-xl font-semibold">{seriousFlags}</p>
              </div>
              <div className="rounded-lg border p-3 flex-1">
                <p className="text-xs text-blue-600 font-medium">Info Gaps</p>
                <p className="text-xl font-semibold">{infoGapFlags}</p>
              </div>
            </div>
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                View all {RED_FLAG_DEFINITIONS.length} flag definitions
              </summary>
              <div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto">
                {RED_FLAG_DEFINITIONS.map((flag) => (
                  <div
                    key={flag.id}
                    className="flex items-start gap-2 rounded-md border px-3 py-2"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 mt-0.5 ${
                        flag.severity === "critical"
                          ? "border-red-300 text-red-700"
                          : flag.severity === "serious"
                            ? "border-amber-300 text-amber-700"
                            : flag.severity === "moderate"
                              ? "border-yellow-300 text-yellow-700"
                              : "border-blue-300 text-blue-700"
                      }`}
                    >
                      {flag.severity}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{flag.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {flag.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
            <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
              Custom flag definitions coming soon. Currently using the default set.
            </p>
          </CardContent>
        </Card>
    </SettingsPageLayout>
  );
}
