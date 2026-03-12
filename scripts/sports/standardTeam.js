export async function calculateStandardTeam(apiUniqueId, sportUrl) {
  try {
    const res = await fetch(sportUrl);
    if (!res.ok) throw new Error(`Failed to fetch from ${sportUrl}`);

    const data = await res.json();
    let teamStats = null;

    if (data.children) {
      for (const conference of data.children) {
        if (conference.standings && conference.standings.entries) {
          const found = conference.standings.entries.find(
            (t) => t.team.id === apiUniqueId,
          );
          if (found) {
            teamStats = found;
            break;
          }
        }
      }
    }

    if (!teamStats) {
      console.warn(
        `Could not find team ID ${apiUniqueId} in current standings.`,
      );
      return {
        regularSeasonScore: 0,
        postseasonScore: 0,
        breakdown: null,
      };
    }

    let regularSeasonScore = 0;
    let breakdown = null;

    // --- NHL LOGIC (Points based: Max 164 points) ---
    if (sportUrl.includes("nhl")) {
      const pointsStat = teamStats.stats.find((s) => s.name === "points");
      const tablePoints = pointsStat ? pointsStat.value : 0;

      const winsStat = teamStats.stats.find((s) => s.name === "wins");
      const lossesStat = teamStats.stats.find((s) => s.name === "losses");
      const otlStat = teamStats.stats.find((s) => s.name === "OTLosses");
      const gpStat = teamStats.stats.find((s) => s.name === "gamesPlayed");

      regularSeasonScore = Math.round((tablePoints / 164) * 400);

      breakdown = {
        sportType: "nhl_points",
        regularSeason: {
          label: "NHL Table Points",
          formula: "(tablePoints / 164) × 400",
          inputs: {
            wins: winsStat ? winsStat.value : 0,
            losses: lossesStat ? lossesStat.value : 0,
            otLosses: otlStat ? otlStat.value : 0,
            gamesPlayed: gpStat ? gpStat.value : 0,
            tablePoints: tablePoints,
            maxTablePoints: 164,
          },
          computed: regularSeasonScore,
          max: 400,
        },
        postseason: {
          label: "Playoff Advancement",
          formula: "Cumulative bracket bonuses",
          milestones: [
            { label: "Make Playoffs", pts: 60, achieved: false },
            { label: "Advance to Round 2", pts: 90, achieved: false },
            { label: "Conference Finals", pts: 120, achieved: false },
            { label: "Stanley Cup Finals", pts: 150, achieved: false },
            { label: "Win Stanley Cup", pts: 180, achieved: false },
          ],
          computed: 0,
          max: 600,
        },
      };
    }
    // --- STANDARD LOGIC (Win % based) ---
    else {
      const winPercentStat = teamStats.stats.find(
        (s) => s.name === "winPercent",
      );
      const winPercent = winPercentStat ? winPercentStat.value : 0;

      const winsStat = teamStats.stats.find((s) => s.name === "wins");
      const lossesStat = teamStats.stats.find((s) => s.name === "losses");
      const gpStat = teamStats.stats.find((s) => s.name === "gamesPlayed");

      regularSeasonScore = Math.round(winPercent * 400);

      // Determine sport-specific postseason milestones based on URL
      let postMilestones = [];

      if (sportUrl.includes("wnba")) {
        postMilestones = [
          { label: "Make Playoffs", pts: 90, achieved: false },
          { label: "Semifinals", pts: 130, achieved: false },
          { label: "WNBA Finals", pts: 170, achieved: false },
          { label: "Win Championship", pts: 210, achieved: false },
        ];
      } else if (sportUrl.includes("college-football")) {
        postMilestones = [
          { label: "Make 12-Team CFP", pts: 50, achieved: false },
          { label: "Quarterfinals", pts: 75, achieved: false },
          { label: "Semifinals", pts: 100, achieved: false },
          { label: "National Championship Game", pts: 150, achieved: false },
          { label: "Win National Championship", pts: 225, achieved: false },
        ];
      } else if (
        sportUrl.includes("mens-college-basketball") ||
        sportUrl.includes("womens-college-basketball")
      ) {
        postMilestones = [
          { label: "Round of 64", pts: 20, achieved: false },
          { label: "Round of 32", pts: 40, achieved: false },
          { label: "Sweet 16", pts: 60, achieved: false },
          { label: "Elite 8", pts: 80, achieved: false },
          { label: "Final Four", pts: 110, achieved: false },
          { label: "Title Game", pts: 130, achieved: false },
          { label: "National Champion", pts: 100, achieved: false },
        ];
      } else if (sportUrl.includes("womens-college-volleyball")) {
        postMilestones = [
          { label: "Make NCAA Tournament", pts: 60, achieved: false },
          { label: "Sweet 16", pts: 90, achieved: false },
          { label: "Elite 8", pts: 120, achieved: false },
          { label: "Final Four", pts: 150, achieved: false },
          { label: "Win Championship", pts: 180, achieved: false },
        ];
      } else {
        // Standard pro team (NBA, NFL, MLB)
        postMilestones = [
          { label: "Make Playoffs", pts: 60, achieved: false },
          { label: "Advance to Round 2", pts: 90, achieved: false },
          { label: "Conference Finals", pts: 120, achieved: false },
          { label: "Finals", pts: 150, achieved: false },
          { label: "Win Championship", pts: 180, achieved: false },
        ];
      }

      breakdown = {
        sportType: "standard_win_pct",
        regularSeason: {
          label: "Win Percentage",
          formula: "(winPct × 400)",
          inputs: {
            wins: winsStat ? winsStat.value : 0,
            losses: lossesStat ? lossesStat.value : 0,
            gamesPlayed: gpStat ? gpStat.value : 0,
            winPct: winPercent,
          },
          computed: regularSeasonScore,
          max: 400,
        },
        postseason: {
          label: "Playoff Advancement",
          formula: "Cumulative bracket bonuses",
          milestones: postMilestones,
          computed: 0,
          max: 600,
        },
      };
    }

    return { regularSeasonScore, postseasonScore: 0, breakdown };
  } catch (error) {
    console.error("Standard Team Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}
