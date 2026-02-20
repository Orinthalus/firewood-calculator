import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const friendlyMessage = message.includes("404")
    ? "That postcode wasn't found. Please check it and try again."
    : message.includes("soil")
      ? "No soil data is available near this location. This often happens with coastal or urban postcodes."
      : message.includes("No grid reference")
        ? "Only Great Britain postcodes are supported (not Northern Ireland or Channel Islands)."
        : message.includes("Climate data")
          ? "Climate data is not available for this location."
          : "Something went wrong while looking up that postcode. Please try again.";

  return (
    <div className="max-w-md mx-auto" data-testid="error-state">
      <Card>
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-destructive/10 rounded-md">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Lookup failed</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{friendlyMessage}</p>
          </div>
          <Button variant="outline" onClick={onRetry} data-testid="button-retry">
            <RotateCcw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
