import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { companyProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoringBreakdown } from "@/components/deals/scoring-breakdown";
import { SCORING_DIMENSIONS } from "@/lib/scoring/rubric";
import { getDeal } from "@/lib/db/cached-queries";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { dealId } = await params;

  const [deal, profile] = await Promise.all([
    getDeal(dealId),
    db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.dealId, dealId))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  if (!deal) notFound();

  if (!profile) {
    return (
      <div className="max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold">Company Profile</h2>
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No AI-generated profile yet. Upload an IM document to generate one automatically.
          </p>
        </div>
      </div>
    );
  }

  const strengths = (profile.strengths as string[] | null) ?? [];
  const keyRisks = (profile.keyRisks as string[] | null) ?? [];

  // Build dimension scores and rationales from the stored scoring breakdown
  let dimensionScores: Record<string, number> | null = null;
  let dimensionRationales: Record<string, string> | null = null;
  if (profile.scoringBreakdown) {
    const breakdown = profile.scoringBreakdown as Record<string, number | { score: number; rationale: string }>;
    const scores: Record<string, number> = {};
    const rationales: Record<string, string> = {};
    for (const dim of SCORING_DIMENSIONS) {
      const entry = breakdown[dim.id];
      if (entry === undefined) continue;
      if (typeof entry === "number") {
        scores[dim.id] = entry;
      } else {
        scores[dim.id] = entry.score;
        if (entry.rationale) rationales[dim.id] = entry.rationale;
      }
    }
    if (Object.keys(scores).length > 0) {
      dimensionScores = scores;
      if (Object.keys(rationales).length > 0) dimensionRationales = rationales;
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Company Profile</h2>
        {profile.aiOverallScore && (
          <Badge variant="secondary" className="text-sm">
            AI Score: {Number(profile.aiOverallScore).toFixed(1)} / 5.0
          </Badge>
        )}
      </div>

      {profile.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{profile.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* IM Scoring Breakdown */}
      {dimensionScores && (
        <ScoringBreakdown
          scores={dimensionScores}
          rationales={dimensionRationales ?? undefined}
          overallScore={profile.aiOverallScore ? Number(profile.aiOverallScore) : null}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {profile.businessModel && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Business Model</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{profile.businessModel}</p>
            </CardContent>
          </Card>
        )}

        {profile.marketPosition && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Market Position</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{profile.marketPosition}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {strengths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 space-y-1">
              {strengths.map((s, i) => (
                <li key={i} className="text-sm">{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {keyRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Key Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-4 space-y-1">
              {keyRisks.map((r, i) => (
                <li key={i} className="text-sm">{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {profile.industryTrends && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Industry Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{profile.industryTrends}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        {profile.generatedAt
          ? `Generated ${new Date(profile.generatedAt).toLocaleString()}`
          : ""}
        {profile.modelVersion ? ` | Model: ${profile.modelVersion}` : ""}
      </p>
    </div>
  );
}
