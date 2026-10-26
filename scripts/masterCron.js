/**
 * masterCron.js — nightly score update.
 *
 * For every roster pick that is (a) not a manual override, (b) in a sport
 * switched on in Admin, and (c) inside its season window for its portfolio
 * year (lib/sportConfig.js → SEASON_WINDOWS):
 *   1. fetch raw regular-season inputs from the sport's data source,
 *   2. carry forward the postseason milestones already saved on the pick
 *      (entered in the admin editor; F1 Crown Jewels come from sportConfig),
 *   3. score both halves with lib/scoringSchemas.js and write the three
 *      score columns plus score_breakdown.
 *
 * A failed fetch never writes a 0 — the pick keeps its last good score and
 * the run exits non-zero so the GitHub Action shows red.
 *
 * Usage:
 *   node scripts/masterCron.js                      # live run (writes)
 *   node scripts/masterCron.js --dry-run            # print changes, write nothing
 *   node scripts/masterCron.js --dry-run --sport=16 # one sport
 *   node scripts/masterCron.js --dry-run --ignore-window --year=2026-2027
 *   node scripts/masterCron.js --dry-run --sport=10 --include-off --ignore-window
 *                                     # test a sport before switching it on
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";
import {
  SUMMER_INTL_SOCCER_CONFIG,
  SPORT_CONFIG,
  seasonWindowFor,
  isInSeasonWindow,
} from "../lib/sportConfig.js";
import { schemaFor, hydrateMilestones, scorePick } from "../lib/scoringSchemas.js";
import {
  winPctInputs,
  tablePointsInputs,
  scheduleRecordInputs,
  summerIntlInputs,
} from "./sports/espn.js";
import { f1Inputs, crownJewelMilestones } from "./sports/f1.js";
import { calculatePGA } from "./sports/pga.js";
import { calculateLPGA } from "./sports/lpga.js";
import { calculateATP } from "./sports/atp.js";
import { calculateWTA } from "./sports/wta.js";

// ─── CLI flags ────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const DRY_RUN = flag("dry-run");
const IGNORE_WINDOW = flag("ignore-window");
const INCLUDE_OFF = flag("include-off"); // dry-run testing of switched-off sports
const ONLY_SPORT = opt("sport") ? Number(opt("sport")) : null;
const ONLY_YEAR = opt("year") || null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ─── Data sources ─────────────────────────────────────────────
const ESPN = "https://site.api.espn.com/apis/v2/sports";
const WIN_PCT_FEEDS = {
  1: `${ESPN}/basketball/nba/standings`,
  2: `${ESPN}/basketball/wnba/standings`,
  3: `${ESPN}/football/nfl/standings`,
  4: `${ESPN}/baseball/mlb/standings`,
  9: `${ESPN}/football/college-football/standings?group=80`, // FBS
  10: `${ESPN}/basketball/mens-college-basketball/standings?group=50`, // D-I
  11: `${ESPN}/basketball/womens-college-basketball/standings?group=50`, // D-I
};
// If a college team is missing from the conference standings feed, count
// its record from its own schedule instead (regular season only).
const SCHEDULE_FALLBACK = {
  9: "football/college-football",
  10: "basketball/mens-college-basketball",
  11: "basketball/womens-college-basketball",
};
const TABLE_FEEDS = {
  5: { url: `${ESPN}/hockey/nhl/standings`, kind: "hockey" },
  6: { url: `${ESPN}/soccer/usa.1/standings`, kind: "soccer" },
  8: { url: `${ESPN}/soccer/eng.1/standings`, kind: "soccer" },
  18: { url: `${ESPN}/soccer/usa.nwsl/standings`, kind: "soccer" },
};

/** Adapter for the older scrapers (tennis/golf), which return a breakdown. */
async function scraperInputs(fn, name) {
  const result = await fn(name);
  const inputs = result?.breakdown?.regularSeason?.inputs;
  if (!inputs || !inputs.leaderPoints) throw new Error(`scraper found no points for ${name}`);
  return { inputs, returnedSeason: null };
}

/** Raw regular-season inputs for one pick. Throws on any failure. */
async function regularSeasonInputs(pick, window) {
  const sportId = pick.sport_id;
  const season = window.espnSeason;
  const apiId = pick.entities.api_unique_id;
  const name = pick.entities.display_name;

  if (WIN_PCT_FEEDS[sportId]) {
    try {
      return await winPctInputs(WIN_PCT_FEEDS[sportId], season, apiId);
    } catch (err) {
      if (!SCHEDULE_FALLBACK[sportId]) throw err;
      const viaSchedule = await scheduleRecordInputs(SCHEDULE_FALLBACK[sportId], season, apiId);
      return { ...viaSchedule, note: `standings miss (${err.message}); used team schedule` };
    }
  }
  if (TABLE_FEEDS[sportId]) {
    const { url, kind } = TABLE_FEEDS[sportId];
    return tablePointsInputs(url, season, apiId, kind);
  }
  switch (sportId) {
    case 7:
      return scheduleRecordInputs("volleyball/womens-college-volleyball", season, apiId);
    case 16:
      return f1Inputs(season, name);
    case 19: {
      const cfg = SUMMER_INTL_SOCCER_CONFIG[pick.portfolio_year];
      if (!cfg) throw new Error(`no summer tournament configured for ${pick.portfolio_year}`);
      return summerIntlInputs(cfg.espnSlug, season, name);
    }
    case 12:
      return scraperInputs(calculateATP, name);
    case 13:
      return scraperInputs(calculateWTA, name);
    case 14:
      return scraperInputs(calculatePGA, name);
    case 15:
      return scraperInputs(calculateLPGA, name);
    default:
      return null; // manual-entry sport (MMA)
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function run() {
  console.log(`🚀 Score update ${DRY_RUN ? "(DRY RUN — nothing will be written)" : ""}`);
  const today = new Date();

  const { data: sports, error: sportsError } = await supabase
    .from("sports")
    .select("id, is_scraping_active");
  if (sportsError) throw sportsError;
  const active = Object.fromEntries(sports.map((s) => [s.id, s.is_scraping_active]));

  let query = supabase
    .from("roster_picks")
    .select(
      `id, sport_id, portfolio_year, is_manual_override, score_breakdown,
       regular_season_score, postseason_score, total_score,
       users ( name ), entities ( api_unique_id, display_name )`,
    )
    .not("entity_id", "is", null);
  if (ONLY_SPORT) query = query.eq("sport_id", ONLY_SPORT);
  if (ONLY_YEAR) query = query.eq("portfolio_year", ONLY_YEAR);
  const { data: picks, error: picksError } = await query;
  if (picksError) throw picksError;

  const counts = { updated: 0, unchanged: 0, skipped: 0, failed: 0 };
  const failures = [];
  const rows = [];
  const seasonWarnings = new Set();

  picks.sort((a, b) => (SPORT_CONFIG[a.sport_id]?.order ?? 99) - (SPORT_CONFIG[b.sport_id]?.order ?? 99));

  for (const pick of picks) {
    const sportName = SPORT_CONFIG[pick.sport_id]?.name || `Sport ${pick.sport_id}`;
    const label = `${sportName} · ${pick.entities.display_name} (${pick.users?.name ?? "?"})`;
    const window = seasonWindowFor(pick.portfolio_year, pick.sport_id);

    // Skip reasons, in order of precedence
    let skip = null;
    if (pick.is_manual_override) skip = "manual override";
    else if (!active[pick.sport_id] && !(INCLUDE_OFF && DRY_RUN)) skip = "sport switched off";
    else if (!window) skip = `no season window for ${pick.portfolio_year}`;
    else if (!IGNORE_WINDOW && !isInSeasonWindow(window, today))
      skip = `outside season window (${window.start} → ${window.end})`;
    if (skip) {
      counts.skipped++;
      if (DRY_RUN) rows.push({ label, note: `skip: ${skip}` });
      continue;
    }

    const schema = schemaFor(pick.sport_id, SUMMER_INTL_SOCCER_CONFIG[pick.portfolio_year]);
    try {
      const source = await regularSeasonInputs(pick, window);
      if (!source) {
        counts.skipped++;
        if (DRY_RUN) rows.push({ label, note: "skip: manual-entry sport" });
        continue;
      }
      if (source.returnedSeason && Number(source.returnedSeason) !== Number(window.espnSeason))
        seasonWarnings.add(
          `${sportName}: asked ESPN for season ${window.espnSeason}, got ${source.returnedSeason}`,
        );

      const milestones =
        pick.sport_id === 16
          ? crownJewelMilestones(schema, window.espnSeason, pick.entities.display_name)
          : hydrateMilestones(schema, pick.score_breakdown?.postseason);

      const scored = scorePick(schema, source.inputs, milestones);
      const changed =
        Number(pick.regular_season_score) !== scored.regularSeasonScore ||
        Number(pick.postseason_score) !== scored.postseasonScore;

      rows.push({
        note2: source.note,
        label,
        old: `${Number(pick.regular_season_score)} + ${Number(pick.postseason_score)} = ${Number(pick.total_score)}`,
        new: `${scored.regularSeasonScore} + ${scored.postseasonScore} = ${scored.totalScore}`,
        changed,
        inputs: source.inputs,
      });

      if (!DRY_RUN) {
        const { error } = await supabase
          .from("roster_picks")
          .update({
            regular_season_score: scored.regularSeasonScore,
            postseason_score: scored.postseasonScore,
            total_score: scored.totalScore,
            score_breakdown: scored.breakdown,
            last_updated_at: new Date().toISOString(),
          })
          .eq("id", pick.id);
        if (error) throw new Error(`write failed: ${error.message}`);
      }
      if (changed) counts.updated++;
      else counts.unchanged++;
    } catch (err) {
      counts.failed++;
      failures.push(`${label}: ${err.message}`);
    }
  }

  // ─── Report ──────────────────────────────────────────────────
  for (const r of rows) {
    if (r.note) {
      if (args.includes("--verbose")) console.log(`   ${r.label} — ${r.note}`);
      continue;
    }
    const mark = r.changed ? "✏️ " : "   ";
    console.log(`${mark}${r.label}: ${r.old}  →  ${r.new}`);
    if (DRY_RUN) console.log(`      inputs ${JSON.stringify(r.inputs)}`);
    if (r.note2) console.log(`      ℹ️ ${r.note2}`);
  }
  for (const w of seasonWarnings) console.warn(`⚠️ ${w}`);
  for (const f of failures) console.error(`❌ ${f}`);
  console.log(
    `🏁 ${DRY_RUN ? "Would update" : "Updated"} ${counts.updated}, unchanged ${counts.unchanged}, ` +
      `skipped ${counts.skipped}, failed ${counts.failed}`,
  );
  if (counts.failed > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error("🔥 Fatal error during update:", err);
  process.exitCode = 1;
});

