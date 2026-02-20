import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TreePine } from "lucide-react";

export function LoadingState() {
  return (
    <div className="max-w-md mx-auto space-y-6" data-testid="loading-state">
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="p-3 bg-primary/10 rounded-md animate-pulse">
                <TreePine className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Analysing your site...</p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Fetching soil, climate and topographic data from Forest Research.
                This may take 10-20 seconds.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-md" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-32 rounded-md" />
          <Skeleton className="h-32 rounded-md" />
          <Skeleton className="h-32 rounded-md" />
        </div>
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}
