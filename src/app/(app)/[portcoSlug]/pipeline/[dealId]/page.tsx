import { redirect } from "next/navigation";

export default async function DealPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;
  redirect(`/${portcoSlug}/pipeline/${dealId}/overview`);
}
