import { notFound } from "next/navigation";
import { getPortcoBySlug } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GdriveSettings } from "@/components/settings/gdrive-settings";
import { SettingsNav } from "@/components/settings/settings-nav";
import { getConnectedAccount, getFolderName } from "@/lib/gdrive/client";
import { MessageSquare, Mail, Notebook } from "lucide-react";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const portco = await getPortcoBySlug(portcoSlug);
  if (!portco) notFound();

  const isGdriveConnected = Boolean(portco.gdriveServiceAccountEnc);

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

      <SettingsNav portcoSlug={portcoSlug} />

      <div className="max-w-2xl space-y-6">
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
              <div className="flex items-center gap-2">
                <Mail className="size-5" />
                <div>
                  <CardTitle className="text-base">Gmail</CardTitle>
                  <CardDescription>Sync broker emails and deal correspondence</CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Coming soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connect Gmail to automatically track broker emails and link them to deals.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5" />
                <div>
                  <CardTitle className="text-base">Slack</CardTitle>
                  <CardDescription>Notification webhook configuration</CardDescription>
                </div>
              </div>
              <Badge variant={portco.slackWebhookUrl ? "default" : "secondary"}>
                {portco.slackWebhookUrl ? "Connected" : "Coming soon"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get notified in Slack when new deals are sourced, scores change, or red flags are detected.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Notebook className="size-5" />
                <div>
                  <CardTitle className="text-base">Granola</CardTitle>
                  <CardDescription>Meeting notes and deal discussion sync</CardDescription>
                </div>
              </div>
              <Badge variant="secondary">Coming soon</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sync meeting notes from Granola to automatically capture deal discussions and IC decisions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
