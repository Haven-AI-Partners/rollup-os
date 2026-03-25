import { Skeleton } from "@/components/ui/skeleton";

export default function FilesLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <div className="space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
            <Skeleton className="size-4" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
