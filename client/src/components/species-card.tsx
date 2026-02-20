import type { SpeciesResult } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TreePine, TrendingUp, AlertTriangle } from "lucide-react";

interface SpeciesCardProps {
  species: SpeciesResult;
  rank: number;
}

function getSuitabilityVariant(label: string): "default" | "secondary" | "destructive" | "outline" {
  switch (label) {
    case "Very Suitable":
    case "Suitable":
      return "default";
    case "Moderate":
      return "secondary";
    case "Marginal":
    case "Unsuitable":
      return "destructive";
    default:
      return "outline";
  }
}

function fmt(n: number, dp = 0) {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: dp,
    minimumFractionDigits: dp,
  });
}

export function SpeciesCard({ species, rank }: SpeciesCardProps) {
  return (
    <Card data-testid={`card-species-${species.code}`} className="hover-elevate">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-semibold shrink-0 mt-0.5">
            {rank}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-tight" data-testid={`text-species-name-${species.code}`}>
              {species.name}
            </h4>
            <p className="text-[11px] text-muted-foreground italic truncate" data-testid={`text-species-scientific-${species.code}`}>
              {species.scientificName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant={getSuitabilityVariant(species.suitabilityLabel)}
            data-testid={`badge-suitability-${species.code}`}
          >
            {species.suitabilityLabel}
          </Badge>
          <Badge variant="outline" data-testid={`badge-yield-${species.code}`}>
            YC {species.yieldClass}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5" data-testid={`stat-energy-${species.code}`}>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Zap className="h-3 w-3" />
              <span className="text-[11px]">Energy</span>
            </div>
            <p className="text-xs font-medium">{fmt(species.kwhPerHaYear)} kWh/ha/yr</p>
          </div>
          <div className="space-y-0.5" data-testid={`stat-yield-${species.code}`}>
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span className="text-[11px]">Volume</span>
            </div>
            <p className="text-xs font-medium">{species.cubicMetresPerHaYear} m\u00B3/ha/yr</p>
          </div>
        </div>

        {species.limitingFactors.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid={`text-limiting-${species.code}`}>
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-destructive/70" />
            <span className="leading-relaxed">{species.limitingFactors[0]}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
