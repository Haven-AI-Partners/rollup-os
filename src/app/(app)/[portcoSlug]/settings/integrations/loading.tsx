import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function IntegrationsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="flex gap-1 border-b pb-0">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="max-w-2xl space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
