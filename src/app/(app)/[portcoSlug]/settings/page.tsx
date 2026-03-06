import { notFound } from "next/navigation";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GdriveSettings } from "@/components/settings/gdrive-settings";
import { getConnectedAccount, getFolderName } from "@/lib/gdrive/client";

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

  const isGdriveConnected = Boolean(portco.gdriveServiceAccountEnc);

  // Fetch GDrive details in parallel if connected
  const [accountInfo, folderName] = isGdriveConnected
    ? await Promise.all([
        getConnectedAccount(portco.id).catch(() => null),
        portco.gdriveFolderId
          ? getFolderName(portco.id, portco.gdriveFolderId).catch(() => null)
          : Promise.resolve(null),
      ])
    : [null, null];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage {portco.name} configuration and integrations.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PortCo Profile</CardTitle>
            <CardDescription>Edit company details and acquisition criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Profile editing coming soon.</p>
          </CardContent>
        </Card>

        <GdriveSettings
          portcoSlug={portcoSlug}
          isConnected={isGdriveConnected}
          folderId={portco.gdriveFolderId}
          folderName={folderName}
          accountEmail={accountInfo?.email ?? null}
          accountName={accountInfo?.displayName ?? null}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Slack Integration</CardTitle>
                <CardDescription>Notification webhook configuration</CardDescription>
              </div>
              <Badge variant={portco.slackWebhookUrl ? "default" : "secondary"}>
                {portco.slackWebhookUrl ? "Connected" : "Not configured"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Slack integration coming soon.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Scoring Rubric</CardTitle>
                <CardDescription>8-dimension IM scoring criteria and weights</CardDescription>
              </div>
              <Badge variant={portco.scoringRubric ? "default" : "secondary"}>
                {portco.scoringRubric ? "Configured" : "Not configured"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Scoring rubric editing coming soon.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
