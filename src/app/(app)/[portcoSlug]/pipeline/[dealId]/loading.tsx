import { Skeleton } from "@/components/ui/skeleton";

export default function DealTabLoading() {
  return (
    <div className="max-w-2xl space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
