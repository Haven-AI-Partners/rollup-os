import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deals, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getActivityLog } from "@/lib/actions/deals";
import { Badge } from "@/components/ui/badge";

const actionLabels: Record<string, string> = {
  deal_created: "Created",
  stage_changed: "Stage",
  status_changed: "Status",
  comment_added: "Comment",
  task_created: "Task",
  task_completed: "Task",
  file_uploaded: "File",
  profile_generated: "Profile",
  transferred: "Transfer",
  assigned: "Assigned",
};

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; dealId: string }>;
}) {
  const { dealId } = await params;

  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  if (!deal) notFound();

  const activity = await getActivityLog(dealId);

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Activity Timeline</h2>
      {activity.length > 0 ? (
        <div className="relative space-y-0">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
          {activity.map((entry) => (
            <div key={entry.id} className="relative flex gap-4 py-3">
              <div className="relative z-10 mt-0.5 size-6 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                <div className="size-2 rounded-full bg-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {actionLabels[entry.action] ?? entry.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm">{entry.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      )}
    </div>
  );
}
