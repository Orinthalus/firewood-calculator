// server/frgeospatial.ts
import type { paths } from "../shared/frgeospatial";

const BASE_URL = "https://frgeospatial.uk";

// ---------- Type helpers (derived from OpenAPI) ----------
type Json = Record<string, unknown>;

type PostBody<P extends keyof paths> = paths[P] extends {
  post: { requestBody: { content: { "application/json": infer B } } };
}
  ? B
  : never;

type PostResponse<P extends keyof paths> = paths[P] extends {
  post: { responses: { 200: { content: { "application/json": infer R } } } };
}
  ? R
  : never;

type GetResponse<P extends keyof paths> = paths[P] extends {
  get: { responses: { 200: { content: { "application/json": infer R } } } };
}
  ? R
  : never;

// ---------- Low-level fetch helpers ----------
async function postFR<P extends keyof paths>(
  path: P,
  body: PostBody<P>,
): Promise<PostResponse<P>> {
  const url = `${BASE_URL}${path as string}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    // Log response body to help debugging
    console.error(
      `[FR ERROR] ${String(path)} status=${res.status} body=${text.slice(0, 2000)}`,
    );
    throw new Error(`FR API ${String(path)} failed: ${res.status}`);
  }

  // Log raw payload (trimmed)
  console.log(`[FR RAW] ${String(path)} => ${text.slice(0, 2000)}`);

  return JSON.parse(text) as PostResponse<P>;
}

async function getFR<P extends keyof paths>(path: P): Promise<GetResponse<P>> {
  const url = `${BASE_URL}${path as string}`;

  const res = await fetch(url);
  const text = await res.text();

  if (!res.ok) {
    console.error(
      `[FR ERROR] ${String(path)} status=${res.status} body=${text.slice(0, 2000)}`,
    );
    throw new Error(`FR API ${String(path)} failed: ${res.status}`);
  }

  console.log(`[FR RAW] ${String(path)} => ${text.slice(0, 2000)}`);

  return JSON.parse(text) as GetResponse<P>;
}

// ---------- Raw soil fetch (no logging, used by spiral search) ----------
async function rawSoilFetch(
  loc: [number, number],
): Promise<PostResponse<"/api/soil/extract_values">> {
  const url = `${BASE_URL}/api/soil/extract_values`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ loc }),
  });
  if (!res.ok) {
    throw new Error(`FR API /api/soil/extract_values failed: ${res.status}`);
  }
  return (await res.json()) as PostResponse<"/api/soil/extract_values">;
}

function hasSoilData(data: any): boolean {
  return (
    data &&
    typeof data.smr === "number" &&
    data.smr !== 0 &&
    typeof data.snr === "number" &&
    data.snr !== 0
  );
}

const SOIL_SEARCH_DISTANCES = [0, 250, 500, 1000, 1500, 2000, 3000];

const DIRECTIONS: Array<{ dx: number; dy: number; label: string }> = [
  { dx: 0, dy: 0, label: "centre" },
  { dx: 0, dy: 1, label: "N" },
  { dx: 1, dy: 0, label: "E" },
  { dx: 0, dy: -1, label: "S" },
  { dx: -1, dy: 0, label: "W" },
  { dx: 1, dy: 1, label: "NE" },
  { dx: 1, dy: -1, label: "SE" },
  { dx: -1, dy: -1, label: "SW" },
  { dx: -1, dy: 1, label: "NW" },
];

// ---------- Phase 1 API wrappers ----------
export async function getSoil(loc: [number, number]) {
  const [originE, originN] = loc;

  for (const dist of SOIL_SEARCH_DISTANCES) {
    const dirs = dist === 0 ? [DIRECTIONS[0]] : DIRECTIONS.slice(1);

    for (const { dx, dy, label } of dirs) {
      const tryE = originE + dx * dist;
      const tryN = originN + dy * dist;
      const tryLoc: [number, number] = [tryE, tryN];

      try {
        const data = await rawSoilFetch(tryLoc);
        const tag =
          dist === 0
            ? `[${originE},${originN}]`
            : `[${tryE},${tryN}] (${label} +${dist}m)`;

        console.log(
          `[FR API] Soil attempt loc=${tag} => smr=${(data as any).smr}, snr=${(data as any).snr}`,
        );

        if (hasSoilData(data)) {
          if (dist > 0) {
            console.log(
              `[FR API] Soil data found at ${dist}m ${label} from original location`,
            );
          }
          return data;
        }
      } catch (err: any) {
        const tag =
          dist === 0
            ? `[${originE},${originN}]`
            : `[${tryE},${tryN}] (${label} +${dist}m)`;
        console.log(
          `[FR API] Soil attempt loc=${tag} => ERROR: ${err.message}`,
        );
      }
    }
  }

  throw new Error(
    "No soil data coverage at or near this location (searched up to ~3km). Common on coast/urban pixels.",
  );
}

export async function getTopo(loc: [number, number]) {
  // POST /api/topographic/extract_values
  return postFR("/api/topographic/extract_values", { loc });
}

export async function getClimate(
  opts:
    | {
        loc: [number, number];
        climate_dataset?: string;
        variables?: Array<"at" | "md" | "ct">;
        period_list?: string[];
        rcp_list?: string[];
      }
    | [number, number],
  variables?: Array<"at" | "md" | "ct">,
  period?: string,
  rcp?: string,
  climate_dataset?: string,
) {
  let body: any;
  if (Array.isArray(opts) && typeof opts[0] === "number") {
    body = {
      loc: opts as [number, number],
      climate_dataset: climate_dataset ?? "CHESS_SCAPE_v1",
      variables: variables ?? ["at", "md", "ct"],
      period_list: [period ?? "1980_2000"],
      rcp_list: [rcp ?? "baseline"],
    };
  } else {
    const o = opts as {
      loc: [number, number];
      climate_dataset?: string;
      variables?: Array<"at" | "md" | "ct">;
      period_list?: string[];
      rcp_list?: string[];
    };
    body = {
      loc: o.loc,
      climate_dataset: o.climate_dataset ?? "CHESS_SCAPE_v1",
      variables: o.variables ?? ["at", "md", "ct"],
      period_list: o.period_list ?? ["1980_2000"],
      rcp_list: o.rcp_list ?? ["baseline"],
    };
  }
  return postFR("/api/climate/extract_values", body);
}

export async function runEscV4(
  optsOrLoc:
    | {
        loc: [number, number];
        climate_dataset?: string;
        period_list?: string[];
        rcp_list?: string[];
        smr: number;
        snr: number;
        smr_source?: string;
        snr_source?: string;
        filterWANE?: string;
        filterConifer?: string;
        filterNative?: string;
        filterMain?: string;
        filterAgro?: string;
        brash?: string;
        drainage?: string;
        fertiliser?: string;
        exposure?: string;
      }
    | [number, number],
  smr?: number,
  snr?: number,
  period?: string,
  rcp?: string,
  climate_dataset?: string,
) {
  let body: any;
  if (Array.isArray(optsOrLoc) && typeof optsOrLoc[0] === "number") {
    body = {
      loc: optsOrLoc as [number, number],
      climate_dataset: climate_dataset ?? "CHESS_SCAPE_v1",
      period_list: [period ?? "1980_2000"],
      rcp_list: [rcp ?? "baseline"],
      smr: smr!,
      snr: snr!,
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
    };
  } else {
    const o = optsOrLoc as any;
    body = {
      loc: o.loc,
      climate_dataset: o.climate_dataset ?? "CHESS_SCAPE_v1",
      period_list: o.period_list ?? ["1980_2000"],
      rcp_list: o.rcp_list ?? ["baseline"],
      smr: o.smr,
      snr: o.snr,
      smr_source: o.smr_source ?? "National dataset",
      snr_source: o.snr_source ?? "National dataset",
      filterWANE: o.filterWANE ?? "None",
      filterConifer: o.filterConifer ?? "Broadleaf",
      filterNative: o.filterNative ?? "None",
      filterMain: o.filterMain ?? "None",
      filterAgro: o.filterAgro ?? "None",
      brash: o.brash ?? "None (new planting)",
      drainage: o.drainage ?? "None",
      fertiliser: o.fertiliser ?? "None",
      exposure: o.exposure ?? "None",
    };
  }
  return postFR("/api/models/esc_v4/stand/run", body);
}

export async function getEscSpeciesLookup() {
  // GET /api/species/esc_v4
  return getFR("/api/species/esc_v4");
}

export async function getSoilMappings() {
  // GET /api/soil/mappings
  return getFR("/api/soil/mappings");
}

// ---------- In-memory lookup cache ----------
let escSpeciesCache: {
  byCode: Map<string, { name: string; scientific: string }>;
} | null = null;

export async function getEscSpeciesByCode(
  code?: string,
): Promise<
  | { byCode: Map<string, { name: string; scientific: string }> }
  | { speciesName: string; speciesScientific: string }
  | null
> {
  if (!escSpeciesCache) {
    const list = await getEscSpeciesLookup();

    const byCode = new Map<string, { name: string; scientific: string }>();

    for (const item of list as any[]) {
      if (!item?.speciesCode) continue;
      byCode.set(item.speciesCode, {
        name: item.speciesName ?? item.speciesCode,
        scientific: item.speciesScientific ?? "",
      });
    }

    escSpeciesCache = { byCode };
  }

  if (code !== undefined) {
    const entry = escSpeciesCache.byCode.get(code);
    if (!entry) return null;
    return { speciesName: entry.name, speciesScientific: entry.scientific };
  }

  return escSpeciesCache;
}
