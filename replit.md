# Firewood App (UK)

## Overview
A web application that helps users find the best firewood tree species for their UK land. Users enter a UK postcode and land area, and the app analyses ecological site factors (climate, soil, exposure) using the real Forest Research ESC API to recommend suitable firewood species with yield and energy estimates.

## Architecture
- **Frontend**: React + Vite + TanStack Query + wouter routing + shadcn/ui components
- **Backend**: Express.js with ESC engine calling real Forest Research APIs
- **External APIs**:
  - postcodes.io (free, no auth) for UK postcode geocoding + coordinate conversion
  - Forest Research Geospatial API (frgeospatial.uk/api) for soil, topographic, climate, and ESC V4 model data
- **No database** - stateless analysis tool

## Key Files
- `shared/schema.ts` - TypeScript types and Zod validation for PostcodeInput, CalcInput, SiteFactors, SpeciesResult, CalcResult
- `shared/frgeospatial.d.ts` - OpenAPI-generated types for FR API
- `server/esc-engine.ts` - ESC engine integrating with FR API (soil, topographic, climate extract, ESC V4 model)
- `server/frgeospatial.ts` - Low-level FR API wrappers with spiral soil search
- `server/routes.ts` - POST /api/calc and POST /api/lookup endpoints
- `client/src/pages/home.tsx` - Main page with form and results display
- `client/src/components/postcode-form.tsx` - Postcode + area input form
- `client/src/components/results-display.tsx` - Full results with energy, species, breakdown table
- `client/src/components/site-factors-card.tsx` - Site factors display
- `client/src/components/species-card.tsx` - Individual species card
- `client/src/components/loading-state.tsx` - Loading skeleton
- `client/src/components/error-state.tsx` - Error display with retry

## API Endpoints
- `POST /api/calc` - Body: `{ postcode: string, area_ha: number }` - Returns CalcResult with energy plan
- `POST /api/lookup` - Body: `{ postcode: string }` - Returns ESCResult with site factors and species

## FR API Integration Flow
1. postcodes.io: postcode -> lat/lng -> eastings/northings (EPSG:27700)
2. FR soil extract -> SMR, SNR (with spiral search fallback)
3. FR topographic extract -> elevation, slope, aspect, DAMS
4. FR climate extract -> AT, MD, CT
5. FR ESC V4 model -> species suitability scores, yield classes, limiting factors

## Design
- Warm orange/amber primary color (hue 24) for firewood theme
- Open Sans font family
- Clean, information-dense layout with Card-based sections
- Mobile responsive with proper grid breakpoints
