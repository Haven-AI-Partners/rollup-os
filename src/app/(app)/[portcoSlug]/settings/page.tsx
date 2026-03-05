import { notFound } from "next/navigation";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);

  if (!portco) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage {portco.name} configuration and integrations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PortCo Profile</CardTitle>
            <CardDescription>Edit company details and acquisition criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Profile editing coming soon.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Google Drive</CardTitle>
            <CardDescription>Service account and folder configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={portco.gdriveFolderId ? "default" : "secondary"}>
              {portco.gdriveFolderId ? "Connected" : "Not configured"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Slack Integration</CardTitle>
            <CardDescription>Notification webhook configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={portco.slackWebhookUrl ? "default" : "secondary"}>
              {portco.slackWebhookUrl ? "Connected" : "Not configured"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scoring Rubric</CardTitle>
            <CardDescription>8-dimension IM scoring criteria and weights</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={portco.scoringRubric ? "default" : "secondary"}>
              {portco.scoringRubric ? "Configured" : "Not configured"}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
