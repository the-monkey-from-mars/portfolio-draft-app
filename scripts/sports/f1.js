/**
 * f1.js — Formula 1 inputs.
 *
 * Regular season: (driver's WDC points − their Crown Jewel GP points)
 *                 ÷ (the highest such total on the grid) × 400.
 *   Sprint points always stay in the regular season.
 * Postseason:     Crown Jewel GP finishes from F1_CROWN_JEWELS in
 *                 lib/sportConfig.js, scored with the schema's tiers.
 *
 * WDC totals come from ESPN; Crown Jewel classifications are entered in
 * sportConfig.js after each race (official results, after penalties).
 */
import { fetchJson, withSeason, findByName, namesMatch } from "./espn.js";
import { F1_CROWN_JEWELS, F1_GP_POINTS } from "../../lib/sportConfig.js";
import { F1_CROWN_JEWEL_RACES, f1TierForPosition } from "../../lib/scoringSchemas.js";

const warned = new Set();
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/racing/f1/standings";

/** Crown Jewel GP points per driver name, for every classified driver. */
function crownJewelPointsByName(season) {
  const races = F1_CROWN_JEWELS[season] || {};
  const pts = new Map();
  for (const top10 of Object.values(races)) {
    top10.forEach((name, i) => {
      pts.set(name, (pts.get(name) || 0) + F1_GP_POINTS[i]);
    });
  }
  return pts;
}

/** Finishing position (1–10) per Crown Jewel race for one driver, or null. */
export function crownJewelPositions(season, driverName) {
  const races = F1_CROWN_JEWELS[season] || {};
  return F1_CROWN_JEWEL_RACES.map((race) => {
    const top10 = races[race] || [];
    const idx = top10.findIndex((n) => namesMatch(n, driverName));
    return { race, position: idx >= 0 ? idx + 1 : null, run: top10.length > 0 };
  });
}

/** Postseason milestones for a driver, built from the Crown Jewel config. */
export function crownJewelMilestones(schema, season, driverName) {
  const positions = crownJewelPositions(season, driverName);
  return schema.postseason.milestones.map((m) => {
    const p = positions.find((x) => x.race === m.label);
    return { ...m, selectedTier: f1TierForPosition(p?.position) };
  });
}

export async function f1Inputs(season, driverName) {
  const data = await fetchJson(withSeason(STANDINGS_URL, season));
  const entries = data.children?.[0]?.standings?.entries || data.standings?.entries || [];
  if (!entries.length) throw new Error("F1 standings empty");

  const wdc = (e) => e.stats?.find((s) => s.name === "championshipPts")?.value ?? 0;
  const rank = (e) => e.stats?.find((s) => s.name === "rank")?.value ?? null;
  const nameOf = (e) => e.athlete?.displayName || "";

  // Subtract each driver's Crown Jewel GP points (matched by name).
  const cjByName = crownJewelPointsByName(season);
  const cjFor = (e) => {
    let total = 0;
    for (const [name, pts] of cjByName) if (namesMatch(name, nameOf(e))) total += pts;
    return total;
  };
  const grid = entries
    .filter((e) => e.athlete)
    .map((e) => ({ e, wdc: wdc(e), cj: cjFor(e), nonCj: wdc(e) - cjFor(e) }));

  // Sanity check: every Crown Jewel finisher should map to a driver in the standings.
  for (const name of cjByName.keys()) {
    if (!warned.has(name) && !grid.some((g) => namesMatch(name, nameOf(g.e)))) {
      warned.add(name);
      console.warn(`⚠️ F1: Crown Jewel finisher "${name}" not matched in ESPN standings — check the spelling in sportConfig.js`);
    }
  }

  const leader = grid.reduce((a, b) => (b.nonCj > a.nonCj ? b : a));
  const me = findByName(grid, driverName, (g) => nameOf(g.e));
  if (!me) throw new Error(`driver "${driverName}" not in F1 standings`);

  return {
    inputs: {
      athletePoints: me.nonCj,
      leaderPoints: leader.nonCj,
      leaderName: nameOf(leader.e),
      athleteRank: rank(me.e),
      wdcPoints: me.wdc,
      crownJewelPoints: me.cj,
    },
    returnedSeason: data.children?.[0]?.standings?.season || data.season?.year || null,
  };
}
