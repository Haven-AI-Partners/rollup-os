import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function PortfolioAnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-56 mt-1" />
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-44" /></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-5 w-20 ml-auto" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
