import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PostcodeForm } from "@/components/postcode-form";
import { ResultsDisplay } from "@/components/results-display";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import type { CalcResult } from "@shared/schema";
import { Flame, TreePine, Zap, BarChart3, Leaf } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const [result, setResult] = useState<CalcResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: { postcode: string; area_ha: number }) => {
      const res = await apiRequest("POST", "/api/calc", payload);
      return (await res.json()) as CalcResult;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleSearch = (postcode: string, areaHa: number) => {
    setResult(null);
    mutation.mutate({ postcode, area_ha: areaHa });
  };

  const handleReset = () => {
    setResult(null);
    mutation.reset();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary rounded-md">
              <Flame className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight leading-tight" data-testid="text-app-title">
                Firewood App
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">UK Species Suitability</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <TreePine className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">FR ESC V4 data</span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {!result && !mutation.isPending && !mutation.isError && (
            <div className="space-y-10">
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                  <Leaf className="h-3.5 w-3.5" />
                  Powered by Forest Research ESC V4
                </div>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight" data-testid="text-hero-heading">
                  Plan your firewood for energy independence
                </h2>
                <p className="text-muted-foreground text-base leading-relaxed max-w-lg mx-auto" data-testid="text-hero-description">
                  Enter a UK postcode and your land area. We'll estimate which tree species will
                  maximise firewood yield on your site and what that means in real-world energy.
                </p>
              </div>

              <PostcodeForm onSubmit={handleSearch} isLoading={mutation.isPending} />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {[
                  {
                    icon: BarChart3,
                    title: "Site Analysis",
                    desc: "Climate, soil & topographic data from Forest Research national datasets",
                  },
                  {
                    icon: TreePine,
                    title: "Species Ranking",
                    desc: "Broadleaf species ranked by suitability from the FR ESC V4 model",
                  },
                  {
                    icon: Zap,
                    title: "Energy Estimate",
                    desc: "Expected kWh, dry tonnes, and heating-oil equivalent for your land",
                  },
                ].map((item) => (
                  <Card key={item.title} data-testid={`card-feature-${item.title.toLowerCase().replace(/\s/g, '-')}`}>
                    <CardContent className="pt-5 pb-5 text-center space-y-2.5">
                      <div className="inline-flex items-center justify-center p-2.5 rounded-md bg-primary/8">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {mutation.isPending && <LoadingState />}

          {mutation.isError && !result && (
            <ErrorState
              message={mutation.error?.message || "Something went wrong"}
              onRetry={handleReset}
            />
          )}

          {result && (
            <ResultsDisplay result={result} onNewSearch={handleReset} />
          )}
        </div>
      </main>

      <footer className="border-t bg-card/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-footer">
            Data from Forest Research Ecological Site Classification (ESC V4) via frgeospatial.uk.
            Results are estimates and should not replace professional forestry advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
