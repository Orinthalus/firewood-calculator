// server/esc-engine.ts
import type {
  SiteFactors,
  SpeciesResult,
  ESCResult,
  CalcResult,
  SpeciesBreakdownRow,
  Recommendation,
} from "@shared/schema";
import { getSoil, getTopo, getClimate, runEscV4 } from "./frgeospatial";

/**
 * Energy conversion constants (kWh per solid m³ of wood, at ~20% moisture content).
 * Applied as: kWh/ha/yr = yieldClass × kwhPerCubicMetre × HARVEST_RECOVERY_FACTOR
 */
const DEFAULT_KWH_PER_CUBIC_METRE = 2000;
const HARVEST_RECOVERY_FACTOR = 0.5;

// ---- App rules ----
const EXCLUDED_SPECIES_CODES = new Set<string>([
  "AH", // Ash (Fraxinus excelsior) — exclude due to ash dieback
]);

// Energy equivalence assumptions (kept out of the main UI; expose via "How calculated")
const KWH_PER_KG_WOOD_AT_20MC = 4.1; // ~20% moisture content
const KWH_PER_TONNE_WOOD = KWH_PER_KG_WOOD_AT_20MC * 1000;
const KWH_PER_LITRE_HEATING_OIL_USABLE = 9.0; // ~10kWh/litre gross × ~0.9 boiler efficiency

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function to10(n01: number): number {
  return Math.round(clamp01(n01) * 10 * 10) / 10; // 0–10, 1dp
}

function stemsPerHa(spacingM: number): number {
  // square spacing assumption for SRF hand-scale planting
  return Math.round(10000 / (spacingM * spacingM));
}

function defaultSpacingM(code: string): number {
  // SRF-friendly defaults. Keep these deliberately simple in MVP.
  // We can (and should) replace this with a proper per-(species,system) table later.
  const fast = new Set([
    "CAR", // common alder
    "GAR", // grey alder
    "RAR", // red alder
    "IAR", // italian alder
    "ASP", // aspen
    "HASP", // hybrid aspen
    "BPO", // black poplar
    "PBI", // downy birch
    "SBI", // silver birch
    "WWL", // white willow
    "EGU", // eucalyptus gunnii
    "ENI", // eucalyptus nitens
  ]);

  return fast.has(code) ? 1.5 : 2.0;
}

// ---- Labels ----
const LIMITING_FACTOR_LABELS: Record<string, string> = {
  at: "Accumulated temperature",
  ct: "Continentality",
  smr: "Soil moisture regime",
  snr: "Soil nutrient regime",
  dams: "Wind exposure (DAMS)",
  da: "Wind exposure (DAMS)",
  md: "Moisture deficit",
};

const SMR_LABELS: Record<number, string> = {
  1.0: "Very Wet",
  2.0: "Wet",
  3.0: "Very Moist",
  3.5: "Moist",
  4.0: "Moist",
  5.0: "Fresh",
  6.0: "Slightly Dry",
  7.0: "Moderately Dry",
  8.0: "Very Dry",
};

const SNR_LABELS: Record<number, string> = {
  0.0: "Very Poor (VP1)",
  0.5: "Very Poor (VP2)",
  1.0: "Very Poor (VP3)",
  1.5: "Very Poor-Poor",
  2.0: "Poor",
  3.0: "Medium",
  4.0: "Rich",
  5.0: "Very Rich",
  6.0: "Carbonate",
};

function getSMRLabel(val: number): string {
  if (val === null || val === undefined) return "Not available";
  const rounded = Math.round(val * 2) / 2;
  return SMR_LABELS[rounded] || SMR_LABELS[Math.round(val)] || `SMR ${val}`;
}

function getSNRLabel(val: number): string {
  if (val === null || val === undefined) return "Not available";
  return SNR_LABELS[val] || `SNR ${val}`;
}

// ---- Species metadata (keep as-is; we exclude Ash via EXCLUDED_SPECIES_CODES) ----
const SPECIES_META: Record<
  string,
  {
    name: string;
    scientificName: string;
    kwhPerCubicMetre: number;
    notes: string;
  }
> = {
  AH: {
    name: "Ash",
    scientificName: "Fraxinus excelsior",
    kwhPerCubicMetre: 2250,
    notes:
      "Excellent firewood (burns well even unseasoned). Ash dieback risk must be considered.",
  },
  AMA: {
    name: "Bigleaf Maple",
    scientificName: "Acer macrophyllum",
    kwhPerCubicMetre: 2100,
    notes:
      "Large maple species with good firewood quality. Similar heat output to sycamore.",
  },
  ASP: {
    name: "Aspen",
    scientificName: "Populus tremula",
    kwhPerCubicMetre: 1800,
    notes:
      "Native poplar species. Fast growing with moderate firewood quality.",
  },
  BE: {
    name: "Beech",
    scientificName: "Fagus sylvatica",
    kwhPerCubicMetre: 2350,
    notes:
      "Premium firewood species with excellent heat output and long burn time.",
  },
  BPO: {
    name: "Black Poplar",
    scientificName: "Populus nigra",
    kwhPerCubicMetre: 1750,
    notes:
      "Very fast growing. Lower calorific value but high volume. Best on sheltered, fertile sites.",
  },
  CAR: {
    name: "Common Alder",
    scientificName: "Alnus glutinosa",
    kwhPerCubicMetre: 1950,
    notes:
      "Nitrogen-fixing. Tolerates wet ground well. Moderate firewood quality.",
  },
  EGU: {
    name: "Cider Gum",
    scientificName: "Eucalyptus gunnii",
    kwhPerCubicMetre: 2200,
    notes:
      "Fast-growing eucalyptus. Very high yield but can be invasive. Burns hot with aromatic smoke.",
  },
  ENI: {
    name: "Shining Gum",
    scientificName: "Eucalyptus nitens",
    kwhPerCubicMetre: 2200,
    notes:
      "Extremely fast-growing eucalyptus. Highest yield broadleaf in UK. Burns very hot.",
  },
  GAR: {
    name: "Grey Alder",
    scientificName: "Alnus incana",
    kwhPerCubicMetre: 1950,
    notes:
      "Alternative to common alder. Nitrogen-fixing, tolerates exposed sites.",
  },
  HASP: {
    name: "Hybrid Aspen",
    scientificName: "Populus tremula x tremuloides",
    kwhPerCubicMetre: 1800,
    notes: "Very fast growing hybrid. Good for biomass but burns quickly.",
  },
  HBM: {
    name: "Hornbeam",
    scientificName: "Carpinus betulus",
    kwhPerCubicMetre: 2400,
    notes:
      "Very high density wood. Burns slowly with excellent heat. Often called 'ironwood'.",
  },
  HOL: {
    name: "Holly",
    scientificName: "Ilex aquifolium",
    kwhPerCubicMetre: 2200,
    notes:
      "Burns well even when green. Dense wood with good heat output. Low yield class.",
  },
  IAR: {
    name: "Italian alder",
    scientificName: "Alnus cordata",
    kwhPerCubicMetre: 1950,
    notes:
      "Fast-growing alder. Nitrogen-fixing with good form. More drought tolerant than common alder.",
  },
  JNI: {
    name: "Black Walnut",
    scientificName: "Juglans nigra",
    kwhPerCubicMetre: 2150,
    notes:
      "Valuable timber species. Good firewood with steady heat. Prefers fertile, sheltered sites.",
  },
  JRE: {
    name: "Common Walnut",
    scientificName: "Juglans regia",
    kwhPerCubicMetre: 2150,
    notes:
      "Edible nut producer. Good firewood quality. Requires warm, sheltered, fertile conditions.",
  },
  NOM: {
    name: "Norway maple",
    scientificName: "Acer platanoides",
    kwhPerCubicMetre: 2100,
    notes:
      "Similar to sycamore with good firewood quality. Burns with steady heat.",
  },
  PBI: {
    name: "Downy Birch",
    scientificName: "Betula pubescens",
    kwhPerCubicMetre: 2000,
    notes:
      "Native birch. More tolerant of wet and exposed sites than silver birch. Good firewood.",
  },
  POK: {
    name: "English Oak",
    scientificName: "Quercus robur",
    kwhPerCubicMetre: 2400,
    notes:
      "Excellent firewood with high heat output. Slow growing native hardwood.",
  },
  RAN: {
    name: "Rauli",
    scientificName: "Nothofagus nervosa",
    kwhPerCubicMetre: 2100,
    notes:
      "Southern beech from Chile. Very fast growing with good timber quality. Decent firewood.",
  },
  RAR: {
    name: "Red Alder",
    scientificName: "Alnus rubra",
    kwhPerCubicMetre: 1900,
    notes: "Very fast growing. Nitrogen-fixing with moderate firewood quality.",
  },
  ROK: {
    name: "Red Oak",
    scientificName: "Quercus rubra",
    kwhPerCubicMetre: 2300,
    notes:
      "Fast-growing oak species. Good firewood with high heat output. Non-native.",
  },
  RON: {
    name: "Roble",
    scientificName: "Nothofagus obliqua",
    kwhPerCubicMetre: 2100,
    notes:
      "Southern beech from South America. Very fast growing with excellent yield. Good firewood.",
  },
  ROW: {
    name: "Rowan",
    scientificName: "Sorbus aucuparia",
    kwhPerCubicMetre: 2000,
    notes:
      "Native small tree. Hardy pioneer. Moderate firewood but ecologically valuable.",
  },
  SBI: {
    name: "Silver Birch",
    scientificName: "Betula pendula",
    kwhPerCubicMetre: 2100,
    notes:
      "Hardy pioneer species. Good firewood with pleasant scent. Widely adaptable.",
  },
  SC: {
    name: "Sweet Chestnut",
    scientificName: "Castanea sativa",
    kwhPerCubicMetre: 2200,
    notes:
      "Good coppice species with decent heat output. Can spit when burning. Best in southern England.",
  },
  SLI: {
    name: "Small-leaved Lime",
    scientificName: "Tilia cordata",
    kwhPerCubicMetre: 1800,
    notes:
      "Native lime species. Moderate firewood quality. Excellent for wildlife and coppicing.",
  },
  SOK: {
    name: "Sessile Oak",
    scientificName: "Quercus petraea",
    kwhPerCubicMetre: 2400,
    notes:
      "Outstanding firewood quality with long burn time. Native oak species. Slow growing.",
  },
  SRC: {
    name: "Willow (SRC)",
    scientificName: "Salix spp.",
    kwhPerCubicMetre: 1800,
    notes:
      "Fast-growing willow or poplar grown on 2–5 year rotation. High volume biomass crop.",
  },
  SRF: {
    name: "Eucalyptus glaucescens (SRF)",
    scientificName: "Eucalyptus glaucescens",
    kwhPerCubicMetre: 2000,
    notes:
      "Fast-growing species on 8–20 year rotation. Very high volume biomass production.",
  },
  SY: {
    name: "Sycamore",
    scientificName: "Acer pseudoplatanus",
    kwhPerCubicMetre: 2100,
    notes:
      "Reliable, widely adapted hardwood. Good firewood quality with steady heat output.",
  },
  TST: {
    name: "True Service Tree",
    scientificName: "Sorbus domestica",
    kwhPerCubicMetre: 2100,
    notes:
      "Rare native tree. Dense wood with good heat output. Slow growing but valuable.",
  },
  WCH: {
    name: "Wild Cherry",
    scientificName: "Prunus avium",
    kwhPerCubicMetre: 2100,
    notes:
      "Attractive native tree. Good firewood with pleasant aroma. Fast growing on good sites.",
  },
  WEM: {
    name: "Wych Elm",
    scientificName: "Ulmus glabra",
    kwhPerCubicMetre: 2000,
    notes:
      "Native elm species. Moderate firewood quality. Difficult to split. Dutch Elm Disease risk.",
  },
  WST: {
    name: "Wild Service Tree",
    scientificName: "Sorbus torminalis",
    kwhPerCubicMetre: 2100,
    notes:
      "Rare native indicator of ancient woodland. Dense wood. Very slow growing.",
  },
  WWL: {
    name: "White Willow",
    scientificName: "Salix alba",
    kwhPerCubicMetre: 1700,
    notes:
      "Fast-growing native willow. Low density firewood but very quick to establish. Tolerates wet ground.",
  },
};

// ---- Exported: postcode lookup ----
export async function lookupPostcode(postcode: string): Promise<{
  lat: number;
  lng: number;
  eastings: number;
  northings: number;
  region: string;
}> {
  const clean = postcode.replace(/\s+/g, "").toUpperCase();
  const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Postcode lookup failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const r = data.result;

  if (!r?.eastings || !r?.northings) {
    throw new Error(
      "This postcode does not have grid reference data (may be in Northern Ireland or Channel Islands). Only Great Britain postcodes are supported.",
    );
  }

  return {
    lat: r.latitude,
    lng: r.longitude,
    eastings: r.eastings,
    northings: r.northings,
    region: r.region || r.country || "Great Britain",
  };
}

// ---- Exported: main analysis ----
export async function analyseLocation(
  postcode: string,
  lat: number,
  lng: number,
  eastings: number,
  northings: number,
  region: string,
): Promise<ESCResult> {
  const loc: [number, number] = [eastings, northings];

  // Soil fallback is handled inside getSoil (your spiral search)
  const [soilData, topoData] = await Promise.all([getSoil(loc), getTopo(loc)]);

  const smrNum = (soilData as any).smr as number;
  const snrNum = (soilData as any).snr as number;

  const climateData = await getClimate({
    loc,
    climate_dataset: "CHESS_SCAPE_v1",
    variables: ["at", "md", "ct"],
    period_list: ["1980_2000"],
    rcp_list: ["baseline"],
  });

  const climateBaseline = (climateData as any)?.results?.["1980_2000"]
    ?.baseline;
  if (!climateBaseline || climateBaseline.at === undefined) {
    throw new Error("Climate data not available for this location.");
  }

  const climateAT = Math.round(climateBaseline.at);
  const climateMD = Math.round(climateBaseline.md || 0);
  const climateCT = Math.round((climateBaseline.ct || 0) * 10) / 10;

  const escResult = await runEscV4({
    loc,
    climate_dataset: "CHESS_SCAPE_v1",
    period_list: ["1980_2000"],
    rcp_list: ["baseline"],
    smr: smrNum,
    snr: snrNum,
    smr_source: "National dataset",
    snr_source: "National dataset",
    filterWANE: "None",
    filterConifer: "Broadleaf",
    filterNative: "None",
    filterMain: "None",
    filterAgro: "None",
    brash: "None (new planting)",
    drainage: "None",
    fertiliser: "None",
    exposure: "None",
  });

  if (
    !(escResult as any)?.results ||
    Object.keys((escResult as any).results).length === 0
  ) {
    throw new Error(
      "The ESC V4 model returned no species data for this location.",
    );
  }

  const siteFactors: SiteFactors = {
    postcode: postcode.toUpperCase(),
    latitude: lat,
    longitude: lng,
    eastings,
    northings,
    region,
    accumulatedTemperature: climateAT,
    moistureDeficit: climateMD,
    continentality: climateCT,
    windExposure:
      Math.round((((topoData as any).dams || 0) as number) * 10) / 10,
    estimatedAltitude: Math.round(((topoData as any).elevation || 0) as number),
    slope: Math.round((((topoData as any).slope || 0) as number) * 10) / 10,
    aspect: Math.round((((topoData as any).aspect ?? -1) as number) * 10) / 10,
    soilMoistureRegime: getSMRLabel(smrNum),
    soilNutrientRegime: getSNRLabel(snrNum),
  };

  const speciesResults: SpeciesResult[] = [];

  for (const [codeRaw, periods] of Object.entries(
    (escResult as any).results,
  ) as [string, any][]) {
    const baseline = periods?.["1980_2000"]?.baseline;
    if (!baseline) continue;

    // Clean up forestry-standard prefixes like "FS. BE" -> "BE"
    const code = String(codeRaw)
      .replace(/^FS\.\s*/i, "")
      .trim();

    // Exclude Ash (and anything else in the set)
    if (EXCLUDED_SPECIES_CODES.has(code)) continue;

    const meta = SPECIES_META[code];

    const suit = baseline.suit ?? 0;
    const yc = baseline.yc ?? 0;
    const limFac = baseline.lim_fac ?? "";

    let suitabilityLabel: string;
    if (suit >= 0.8) suitabilityLabel = "Very Suitable";
    else if (suit >= 0.6) suitabilityLabel = "Suitable";
    else if (suit >= 0.4) suitabilityLabel = "Moderate";
    else if (suit >= 0.2) suitabilityLabel = "Marginal";
    else suitabilityLabel = "Unsuitable";

    const limitingFactors: string[] = [];

    if (limFac && suit < 1.0) {
      const label = LIMITING_FACTOR_LABELS[limFac] || limFac;
      const factorScore = baseline[`${limFac}F`];
      if (factorScore !== undefined && factorScore < 1.0) {
        limitingFactors.push(
          `${label} (score: ${Number(factorScore).toFixed(2)})`,
        );
      } else {
        limitingFactors.push(label);
      }
    }

    const allScores = [
      { key: "at", score: baseline.atF },
      { key: "ct", score: baseline.ctF },
      { key: "smr", score: baseline.smrF },
      { key: "snr", score: baseline.snrF },
      { key: "da", score: baseline.daF },
      { key: "md", score: baseline.mdF },
    ];

    for (const { key, score } of allScores) {
      if (score !== undefined && score < 0.7 && key !== limFac) {
        const label = LIMITING_FACTOR_LABELS[key] || key;
        limitingFactors.push(`${label} (score: ${Number(score).toFixed(2)})`);
      }
    }

    const kwhPerM3 = meta?.kwhPerCubicMetre ?? DEFAULT_KWH_PER_CUBIC_METRE;
    const cubicMetresPerHaYear = yc;
    const kwhPerHaYear = Math.round(
      cubicMetresPerHaYear * kwhPerM3 * HARVEST_RECOVERY_FACTOR,
    );

    speciesResults.push({
      name: meta?.name ?? code,
      scientificName: meta?.scientificName ?? "",
      code,
      suitabilityScore: Math.round(suit * 100) / 100,
      suitabilityLabel,
      yieldClass: yc,
      cubicMetresPerHaYear,
      kwhPerHaYear,
      limitingFactors,
      notes: meta?.notes ?? "",
    });
  }

  // Rank by suitability then yield class
  speciesResults.sort(
    (a, b) =>
      b.suitabilityScore - a.suitabilityScore || b.yieldClass - a.yieldClass,
  );

  // Return ALL species for transparency; the UI can choose what to highlight.
  return {
    siteFactors,
    species: speciesResults,
    timestamp: new Date().toISOString(),
  };
}

// ---- MVP: Energy Independence Calculator (postcode + area) ----
export async function analyseLocationCalc(
  postcode: string,
  area_ha: number,
  lat: number,
  lng: number,
  eastings: number,
  northings: number,
  region: string,
): Promise<CalcResult> {
  const esc = await analyseLocation(
    postcode,
    lat,
    lng,
    eastings,
    northings,
    region,
  );

  // Precompute for yield normalisation
  const maxYC = Math.max(
    1,
    ...esc.species.map((s) => (Number.isFinite(s.yieldClass) ? s.yieldClass : 0)),
  );

  // Build full breakdown list (ALL species)
  const breakdown: SpeciesBreakdownRow[] = esc.species.map((s) => {
    const spacing_m = defaultSpacingM(s.code);
    const stems_per_ha = stemsPerHa(spacing_m);

    // Factor scores exist on the raw ESC baseline but are not stored on SpeciesResult.
    // So for MVP we use suitabilityScore (already aggregates constraints) + yield normalisation.
    // Soil/climate sub-scores are approximations (we will improve once we keep raw factor scores).
    const suitability01 = clamp01(s.suitabilityScore);
    const yield01 = clamp01((s.yieldClass || 0) / maxYC);

    const soil_score = to10(suitability01); // placeholder: aggregate until we retain smrF/snrF
    const climate_score = to10(suitability01); // placeholder: aggregate until we retain atF/mdF/ctF/daF
    const yield_score = to10(yield01);

    // Overall: if suitability is 0, overall is 0 ("0 means 0")
    const overall_score = suitability01 === 0 ? 0 : Math.round((to10(suitability01) * 0.6 + yield_score * 0.4) * 10) / 10;

    const zero_reason = overall_score === 0 ? "Suitability = 0" : undefined;

    return {
      species_key: s.code,
      display_name: s.name,
      scientific_name: s.scientificName,
      code: s.code,
      overall_score,
      soil_score,
      climate_score,
      yield_score,
      suitability: Math.round(suitability01 * 100) / 100,
      yield_class: s.yieldClass,
      kwh_per_ha_year: s.kwhPerHaYear,
      spacing_m,
      stems_per_ha,
      zero_reason,
    };
  });

  // Rank by overall score then yield
  const ranked = [...breakdown].sort(
    (a, b) => b.overall_score - a.overall_score || b.yield_score - a.yield_score,
  );

  const top = ranked.slice(0, 3);
  const topRecs: Recommendation[] = top.map((r) => ({
    species_key: r.species_key,
    display_name: r.display_name,
    scientific_name: r.scientific_name,
    code: r.code,
    spacing_m: r.spacing_m,
    stems_per_ha: r.stems_per_ha,
  }));

  const best = ranked[0];
  const bestKwhPerHaYear = best?.kwh_per_ha_year ?? 0;
  const kwh_per_year = Math.round(bestKwhPerHaYear * area_ha);
  const dry_tonnes_per_year = Math.round((kwh_per_year / KWH_PER_TONNE_WOOD) * 10) / 10;
  const oil_litres_per_year = Math.round(kwh_per_year / KWH_PER_LITRE_HEATING_OIL_USABLE);

  const assumptions = [
    "Management: short rotation forestry (hand-scale; no mechanised SRC assumptions)",
    "Planting density uses square spacing defaults (species-dependent)",
    "Yield uses FR ESC V4 yield class outputs (baseline climate 1980–2000)",
    "Energy conversion assumes ~20% moisture content wood (~4.1 kWh/kg)",
    "Heating oil equivalence assumes ~9 kWh usable per litre (typical boiler efficiency)",
    "Expected values are estimates; real outcomes depend on establishment, weeds, browsing, and management.",
  ];

  return {
    inputs: {
      postcode: postcode.toUpperCase(),
      area_ha,
      latitude: lat,
      longitude: lng,
      eastings,
      northings,
      region,
    },
    siteFactors: esc.siteFactors,
    top_recommendations: topRecs,
    outputs: {
      kwh_per_year,
      dry_tonnes_per_year,
      oil_litres_per_year,
    },
    assumptions,
    species_breakdown: ranked,
    timestamp: new Date().toISOString(),
  };
}
