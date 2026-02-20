import type { SiteFactors } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Thermometer,
  Droplets,
  Wind,
  Mountain,
  TrendingDown,
  Leaf,
  Globe,
  Compass,
} from "lucide-react";

interface SiteFactorsCardProps {
  factors: SiteFactors;
}

function formatValue(val: number | null | undefined, suffix: string): string {
  if (val === null || val === undefined) return "N/A";
  return `${val}${suffix}`;
}

function getAspectLabel(degrees: number): string {
  if (degrees < 0) return "N/A";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(degrees / 45) % 8;
  return `${dirs[idx]} (${Math.round(degrees)}\u00B0)`;
}

export function SiteFactorsCard({ factors }: SiteFactorsCardProps) {
  const items = [
    {
      icon: Thermometer,
      label: "Accumulated Temp (AT)",
      value: formatValue(factors.accumulatedTemperature, " day-degrees"),
      desc: "Day-degrees above 5\u00B0C",
    },
    {
      icon: Droplets,
      label: "Moisture Deficit (MD)",
      value: formatValue(factors.moistureDeficit, " mm"),
      desc: "Annual water stress",
    },
    {
      icon: Globe,
      label: "Continentality (CT)",
      value: formatValue(factors.continentality, ""),
      desc: "Temperature range index",
    },
    {
      icon: Wind,
      label: "Wind Exposure (DAMS)",
      value: `${factors.windExposure}`,
      desc: "Detailed Aspect Method of Scoring",
    },
    {
      icon: Mountain,
      label: "Elevation",
      value: `${factors.estimatedAltitude} m`,
      desc: "From national dataset",
    },
    {
      icon: TrendingDown,
      label: "Slope",
      value: `${factors.slope}\u00B0`,
      desc: "Ground slope at location",
    },
    {
      icon: Compass,
      label: "Aspect",
      value: factors.aspect >= 0 ? getAspectLabel(factors.aspect) : "Flat",
      desc: "Slope compass direction",
    },
    {
      icon: Leaf,
      label: "Soil Moisture (SMR)",
      value: factors.soilMoistureRegime,
      desc: "From national soil map",
    },
  ];

  return (
    <Card data-testid="card-site-factors">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h3 className="text-sm font-semibold" data-testid="text-site-factors-heading">Detected Site Factors</h3>
          <Badge variant="secondary" data-testid="badge-region">
            {factors.region}
          </Badge>
          <Badge variant="outline" data-testid="badge-snr">
            SNR: {factors.soilNutrientRegime}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.label} className="space-y-1" data-testid={`factor-${item.label.split(" ")[0].toLowerCase()}`}>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <item.icon className="h-3.5 w-3.5" />
                <span className="text-xs">{item.label}</span>
              </div>
              <p className="text-sm font-medium">{item.value}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
