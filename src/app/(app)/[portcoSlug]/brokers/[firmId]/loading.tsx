import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BrokerDetailLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="size-9 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><Skeleton className="h-5 w-20" /></CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
