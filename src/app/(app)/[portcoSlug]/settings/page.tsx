import { redirect } from "next/navigation";

export default async function SettingsRedirect({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  redirect(`/${portcoSlug}/settings/integrations`);
}
