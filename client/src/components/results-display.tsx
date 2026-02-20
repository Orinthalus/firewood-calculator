import { useMemo, useState } from "react";
import type { CalcResult } from "@shared/schema";
import { SiteFactorsCard } from "@/components/site-factors-card";
import { SpeciesCard } from "@/components/species-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Zap,
  Weight,
  Fuel,
  TreePine,
  Info,
} from "lucide-react";

interface ResultsDisplayProps {
  result: CalcResult;
  onNewSearch: () => void;
}

function fmt(n: number, dp = 0) {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: dp,
    minimumFractionDigits: dp,
  });
}

export function ResultsDisplay({ result, onNewSearch }: ResultsDisplayProps) {
  const [showHow, setShowHow] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [q, setQ] = useState("");

  const topSpeciesCards = useMemo(() => {
    const topKeys = new Set(result.top_recommendations.map((r) => r.code));
    const rows = result.species_breakdown
      .filter((r) => topKeys.has(r.code))
      .slice(0, 3)
      .map((r) => ({
        name: r.display_name,
        scientificName: r.scientific_name,
        code: r.code,
        suitabilityScore: r.suitability,
        suitabilityLabel:
          r.suitability >= 0.8
            ? "Very Suitable"
            : r.suitability >= 0.6
              ? "Suitable"
              : r.suitability >= 0.4
                ? "Moderate"
                : r.suitability >= 0.2
                  ? "Marginal"
                  : "Unsuitable",
        yieldClass: r.yield_class,
        cubicMetresPerHaYear: r.yield_class,
        kwhPerHaYear: r.kwh_per_ha_year,
        limitingFactors: r.zero_reason ? [r.zero_reason] : [],
        notes: "",
      }));
    return rows;
  }, [result]);

  const filteredBreakdown = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = result.species_breakdown;
    const out = query
      ? rows.filter(
          (r) =>
            r.display_name.toLowerCase().includes(query) ||
            r.code.toLowerCase().includes(query),
        )
      : rows;
    return out;
  }, [q, result.species_breakdown]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onNewSearch} data-testid="button-new-search">
          <ArrowLeft className="h-4 w-4 mr-1" />
          New search
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="badge-postcode">
            {result.inputs.postcode}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {fmt(result.inputs.area_ha, 2)} ha
          </span>
        </div>
      </div>

      <Card data-testid="card-energy-outputs">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Energy Estimate</h3>
            <span className="text-xs text-muted-foreground">(based on best species)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-1" data-testid="stat-kwh">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-xs">Expected kWh/year</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight">{fmt(result.outputs.kwh_per_year)}</p>
            </div>
            <div className="space-y-1" data-testid="stat-tonnes">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Weight className="h-3.5 w-3.5" />
                <span className="text-xs">Dry tonnes/year</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight">
                {fmt(result.outputs.dry_tonnes_per_year, 1)}
              </p>
            </div>
            <div className="space-y-1" data-testid="stat-oil">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Fuel className="h-3.5 w-3.5" />
                <span className="text-xs">Oil replacement</span>
              </div>
              <p className="text-2xl font-semibold tracking-tight">
                ~{fmt(result.outputs.oil_litres_per_year)} L/year
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <TreePine className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Top Recommended Species</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topSpeciesCards.map((species, idx) => (
            <SpeciesCard key={species.code} species={species} rank={idx + 1} />
          ))}
        </div>
      </div>

      <SiteFactorsCard factors={result.siteFactors} />

      <div className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHow(!showHow)}
          data-testid="button-toggle-assumptions"
        >
          <Info className="h-3.5 w-3.5 mr-1.5" />
          How is this calculated?
          {showHow ? (
            <ChevronUp className="h-3.5 w-3.5 ml-1.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
          )}
        </Button>

        {showHow && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {result.assumptions.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary/60 mt-0.5 shrink-0">&#x2022;</span>
                    <span className="leading-relaxed">{a}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBreakdown(!showBreakdown)}
          data-testid="button-toggle-breakdown"
        >
          Full species breakdown
          {showBreakdown ? (
            <ChevronUp className="h-3.5 w-3.5 ml-1.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
          )}
        </Button>
      </div>

      {showBreakdown && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="text-sm font-semibold">All Species</h4>
              <div className="flex-1" />
              <Input
                data-testid="input-species-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search species..."
                className="sm:max-w-[220px]"
              />
            </div>

            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[780px] text-sm" data-testid="table-species-breakdown">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Species</th>
                    <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Overall</th>
                    <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Suitability</th>
                    <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Yield</th>
                    <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Spacing</th>
                    <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Stems/ha</th>
                    <th className="py-2 px-2 text-xs font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBreakdown.map((r, idx) => (
                    <tr
                      key={`${r.species_key}-${idx}`}
                      className={`border-b last:border-b-0 ${r.overall_score === 0 ? "opacity-50" : ""}`}
                      data-testid={`row-species-${r.code}`}
                    >
                      <td className="py-2.5 px-2">
                        <span className="font-medium">{r.display_name}</span>
                        <span className="text-muted-foreground ml-1.5 text-xs">({r.code})</span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={r.overall_score >= 7 ? "text-primary font-medium" : ""}>
                          {fmt(r.overall_score, 1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">{fmt(r.suitability * 100, 0)}%</td>
                      <td className="py-2.5 px-2">YC {r.yield_class}</td>
                      <td className="py-2.5 px-2">{fmt(r.spacing_m, 1)} m</td>
                      <td className="py-2.5 px-2">{fmt(r.stems_per_ha)}</td>
                      <td className="py-2.5 px-2 text-xs text-muted-foreground">
                        {r.zero_reason ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Showing {filteredBreakdown.length} of {result.species_breakdown.length} species
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
