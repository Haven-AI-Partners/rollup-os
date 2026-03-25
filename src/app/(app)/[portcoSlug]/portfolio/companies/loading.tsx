import { Skeleton } from "@/components/ui/skeleton";

export default function CompaniesLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
