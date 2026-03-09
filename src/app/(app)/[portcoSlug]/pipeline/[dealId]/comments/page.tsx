import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getComments } from "@/lib/actions/deals";
import { CommentList } from "@/components/deals/comment-list";

export default async function CommentsPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { portcoSlug, dealId } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) notFound();

  const comments = await getComments(dealId);

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
