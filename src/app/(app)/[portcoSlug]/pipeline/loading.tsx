import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="w-72 shrink-0 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            {Array.from({ length: col < 2 ? 3 : col < 4 ? 2 : 1 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
