import { notFound } from "next/navigation";
import { getComments } from "@/lib/actions/deals";
import { CommentList } from "@/components/deals/comment-list";
import { getDeal } from "@/lib/db/cached-queries";

export default async function CommentsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal, comments] = await Promise.all([
    getDeal(dealId),
    getComments(dealId),
  ]);

  if (!deal) notFound();

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Comments</h2>
      <CommentList
        dealId={dealId}
        portcoId={deal.portcoId}
        portcoSlug={portcoSlug}
        initialComments={comments}
      />
    </div>
  );
}
