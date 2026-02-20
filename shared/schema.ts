import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const postcodeSchema = z.object({
  postcode: z
    .string()
    .min(1, "Postcode is required")
    .regex(
      /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
      "Enter a valid UK postcode"
    ),
});

export type PostcodeInput = z.infer<typeof postcodeSchema>;

export const calcSchema = postcodeSchema.extend({
  area_ha: z
    .number({ invalid_type_error: "Area must be a number" })
    .positive("Area must be greater than 0")
    .max(10000, "Area seems too large"),
});

export type CalcInput = z.infer<typeof calcSchema>;

export interface SiteFactors {
  postcode: string;
  latitude: number;
  longitude: number;
  eastings: number;
  northings: number;
  region: string;
  accumulatedTemperature: number;
  moistureDeficit: number;
  continentality: number;
  windExposure: number;
  estimatedAltitude: number;
  slope: number;
  aspect: number;
  soilMoistureRegime: string;
  soilNutrientRegime: string;
}

export interface SpeciesResult {
  name: string;
  scientificName: string;
  code: string;
  suitabilityScore: number;
  suitabilityLabel: string;
  yieldClass: number;
  cubicMetresPerHaYear: number;
  kwhPerHaYear: number;
  limitingFactors: string[];
  notes: string;
}

export interface ESCResult {
  siteFactors: SiteFactors;
  species: SpeciesResult[];
  timestamp: string;
}

export interface CalcOutputs {
  kwh_per_year: number;
  dry_tonnes_per_year: number;
  oil_litres_per_year: number;
}

export interface SpeciesBreakdownRow {
  species_key: string;
  display_name: string;
  scientific_name: string;
  code: string;
  overall_score: number;
  soil_score: number;
  climate_score: number;
  yield_score: number;
  suitability: number;
  yield_class: number;
  kwh_per_ha_year: number;
  spacing_m: number;
  stems_per_ha: number;
  zero_reason?: string;
}

export interface Recommendation {
  species_key: string;
  display_name: string;
  scientific_name: string;
  code: string;
  spacing_m: number;
  stems_per_ha: number;
}

export interface CalcResult {
  inputs: {
    postcode: string;
    area_ha: number;
    latitude: number;
    longitude: number;
    eastings: number;
    northings: number;
    region: string;
  };
  siteFactors: SiteFactors;
  top_recommendations: Recommendation[];
  outputs: CalcOutputs;
  assumptions: string[];
  species_breakdown: SpeciesBreakdownRow[];
  timestamp: string;
}
