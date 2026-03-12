/**
 * calculateNWSL
 *
 * Regular Season (Max 400):
 *   2026+ NWSL has a 30-game season → perfect record = 90 table points.
 *   Formula: (Team's Table Points / 90) * 400
 *
 * Postseason (Max 600):
 *   8-team single-elimination playoff:
 *     Quarterfinal Win   → +100
 *     Semifinal Win      → +200
 *     Championship Win   → +300
 *     Champion total       = 600
 */
export async function calculateNWSL(apiUniqueId, sportUrl) {
  const MAX_TABLE_POINTS = 90;

  try {
    const res = await fetch(sportUrl);
    if (!res.ok)
      throw new Error(`Failed to fetch NWSL standings from ${sportUrl}`);

    const data = await res.json();
    let teamStats = null;

    if (data.children && data.children.length > 0) {
      for (const conference of data.children) {
        const entries = conference.standings?.entries || [];
        const found = entries.find((t) => t.team.id === apiUniqueId);
        if (found) {
          teamStats = found;
          break;
        }
      }
    }

    if (!teamStats && data.standings?.entries) {
      teamStats = data.standings.entries.find((t) => t.team.id === apiUniqueId);
    }

    if (!teamStats) {
      console.warn(`Could not find NWSL team ID ${apiUniqueId} in standings.`);
      return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
    }

    const pointsStat = teamStats.stats.find((s) => s.name === "points");
    const tablePoints = pointsStat ? pointsStat.value : 0;

    const winsStat = teamStats.stats.find((s) => s.name === "wins");
    const drawsStat = teamStats.stats.find(
      (s) => s.name === "ties" || s.name === "draws",
    );
    const lossesStat = teamStats.stats.find((s) => s.name === "losses");
    const gpStat = teamStats.stats.find((s) => s.name === "gamesPlayed");

    const regularSeasonScore = Math.min(
      Math.round((tablePoints / MAX_TABLE_POINTS) * 400),
      400,
    );

    const postseasonScore = 0;

    const breakdown = {
      sportType: "soccer_table",
      regularSeason: {
        label: "NWSL Table Points",
        formula: `(tablePoints / ${MAX_TABLE_POINTS}) × 400`,
        inputs: {
          wins: winsStat ? winsStat.value : 0,
          draws: drawsStat ? drawsStat.value : 0,
          losses: lossesStat ? lossesStat.value : 0,
          gamesPlayed: gpStat ? gpStat.value : 0,
          tablePoints: tablePoints,
          maxTablePoints: MAX_TABLE_POINTS,
        },
        computed: regularSeasonScore,
        max: 400,
      },
      postseason: {
        label: "NWSL Playoffs (Single Elimination)",
        formula: "Cumulative bracket bonuses",
        milestones: [
          { label: "Win Quarterfinal", pts: 100, achieved: false },
          { label: "Win Semifinal", pts: 200, achieved: false },
          { label: "Win NWSL Championship", pts: 300, achieved: false },
        ],
        computed: postseasonScore,
        max: 600,
      },
    };

    return { regularSeasonScore, postseasonScore, breakdown };
  } catch (error) {
    console.error("NWSL Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}
