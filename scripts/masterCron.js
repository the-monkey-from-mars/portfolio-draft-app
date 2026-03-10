import { createClient } from "@supabase/supabase-js";
import { calculateStandardTeam } from "./sports/standardTeam.js";
import { calculateSoccer } from "./sports/soccer.js";
import { calculateF1 } from "./sports/f1.js";
import { calculatePGA } from "./sports/pga.js";
import { calculateMMA } from "./sports/mma.js";
import { calculateWTA } from "./sports/wta.js";
import { calculateATP } from "./sports/atp.js";
import { calculateLPGA } from "./sports/lpga.js";

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// A dictionary mapping your database sport_ids to their respective ESPN Standings API
const API_ENDPOINTS = {
  1: "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings",
  2: "https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings",
  3: "https://site.api.espn.com/apis/v2/sports/football/nfl/standings",
  4: "https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings",
  5: "https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings",
  9: "https://site.api.espn.com/apis/v2/sports/football/college-football/standings?group=80",
  10: "https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings?group=50",
  11: "https://site.api.espn.com/apis/v2/sports/basketball/womens-college-basketball/standings?group=50",
  7: "https://site.api.espn.com/apis/v2/sports/volleyball/womens-college-volleyball/standings?group=50",
  6: "https://site.api.espn.com/apis/v2/sports/soccer/usa.1/standings",
  8: "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings",
};

async function runUpdate() {
  console.log("🚀 Starting Daily Score Update...");

  try {
    // 1. Fetch active sports to check scraping status
    const { data: sportsData, error: sportsError } = await supabase
      .from("sports")
      .select("id, is_scraping_active");

    if (sportsError) throw sportsError;

    // Create a dictionary map for quick lookup: { 1: true, 2: false, ... }
    const sportActiveMap = {};
    sportsData.forEach((s) => {
      sportActiveMap[s.id] = s.is_scraping_active;
    });

    // 2. Fetch all roster picks that have a team assigned
    const { data: picks, error: fetchError } = await supabase
      .from("roster_picks")
      .select(
        `
        id,
        sport_id,
        entity_id,
        is_manual_override,
        entities ( api_unique_id, display_name )
      `,
      )
      .not("entity_id", "is", null);

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${picks.length} active draft picks to process.`);

    // Count overrides for logging
    const overrideCount = picks.filter((p) => p.is_manual_override).length;
    if (overrideCount > 0) {
      console.log(
        `🔧 ${overrideCount} pick(s) have manual overrides and will be skipped.`,
      );
    }

    for (const pick of picks) {
      const sportId = pick.sport_id;
      const teamName = pick.entities.display_name;
      const apiUniqueId = pick.entities.api_unique_id;

      // --- THE OVERRIDE CHECK ---
      // If the admin has manually set scores for this pick, don't touch it!
      if (pick.is_manual_override) {
        console.log(`🔧 Skipping ${teamName} - Manual override is active.`);
        continue;
      }

      // --- THE LOCK CHECK ---
      // If the admin dashboard toggle for this sport is OFF, skip the loop entirely!
      if (!sportActiveMap[sportId]) {
        console.log(`🔒 Skipping ${teamName} - Sport is currently locked.`);
        continue;
      }

      let scores = { regularSeasonScore: 0, postseasonScore: 0 };

      // --- THE ROUTING ENGINE ---

      // If the sport uses a standard ESPN Win % API (NBA, NFL, MLB, NHL, College):
      if ([1, 2, 3, 4, 5, 7, 9, 10, 11].includes(sportId)) {
        console.log(`⏱️ Calculating ${teamName}...`);
        const apiUrl = API_ENDPOINTS[sportId];
        scores = await calculateStandardTeam(apiUniqueId, apiUrl);
      }

      // If the sport is Soccer (6 = MLS, 8 = Premier League):
      else if ([6, 8].includes(sportId)) {
        console.log(`⚽ Calculating Table Math for ${teamName}...`);
        const apiUrl = API_ENDPOINTS[sportId];
        const maxTablePoints = sportId === 6 ? 102 : 114;
        scores = await calculateSoccer(apiUniqueId, apiUrl, maxTablePoints);
      }

      // If the sport is Formula 1 (16):
      else if (sportId === 16) {
        console.log(`🏎️ Calculating F1 Relative Math for ${teamName}...`);
        scores = await calculateF1(teamName);
      }

      // If the sport is PGA Golf (14):
      else if (sportId === 14) {
        console.log(`⛳ Calculating PGA Math for ${teamName}...`);
        scores = await calculatePGA(teamName);
      }

      // If the sport is LPGA Golf (15):
      else if (sportId === 15) {
        console.log(`⛳ Calculating LPGA Math for ${teamName}...`);
        scores = await calculateLPGA(teamName);
      }

      // If the sport is WTA Tennis (13):
      else if (sportId === 13) {
        console.log(`🎾 Calculating WTA Math for ${teamName}...`);
        scores = await calculateWTA(teamName);
      }

      // If the sport is ATP Tennis (12):
      else if (sportId === 12) {
        console.log(`🎾 Calculating ATP Math for ${teamName}...`);
        scores = await calculateATP(teamName);
      }

      // If the sport is MMA (17):
      else if (sportId === 17) {
        console.log(`🥊 Calculating Combat Math for ${teamName}...`);
        scores = await calculateMMA(teamName);
      }

      const totalScore = scores.regularSeasonScore + scores.postseasonScore;

      await supabase
        .from("roster_picks")
        .update({
          regular_season_score: scores.regularSeasonScore,
          postseason_score: scores.postseasonScore,
          total_score: totalScore,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", pick.id);
    }

    console.log("🏁 Daily Update Complete!");
  } catch (error) {
    console.error("🔥 Global Error during update:", error);
  }
}

runUpdate();
