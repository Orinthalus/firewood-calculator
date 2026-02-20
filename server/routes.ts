import type { Express } from "express";
import { createServer, type Server } from "http";
import { lookupPostcode, analyseLocation, analyseLocationCalc } from "./esc-engine";
import { postcodeSchema, calcSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/calc", async (req, res) => {
    try {
      const parsed = calcSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Invalid input",
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { postcode, area_ha } = parsed.data;
      console.log(`[Firewood App] Calculating plan for: ${postcode} (${area_ha} ha)`);

      const location = await lookupPostcode(postcode);
      const result = await analyseLocationCalc(
        postcode,
        area_ha,
        location.lat,
        location.lng,
        location.eastings,
        location.northings,
        location.region,
      );

      res.json(result);
    } catch (error: any) {
      console.error(`[Firewood App] Error:`, error.message);
      const status = error.message?.includes("404") ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  app.post("/api/lookup", async (req, res) => {
    try {
      const parsed = postcodeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Invalid postcode",
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { postcode } = parsed.data;
      console.log(`[Firewood App] Looking up postcode: ${postcode}`);

      const location = await lookupPostcode(postcode);
      const result = await analyseLocation(
        postcode,
        location.lat,
        location.lng,
        location.eastings,
        location.northings,
        location.region
      );

      res.json(result);
    } catch (error: any) {
      console.error(`[Firewood App] Error:`, error.message);
      const status = error.message?.includes("404") ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  });

  return httpServer;
}
