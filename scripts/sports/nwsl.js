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
  const MAX_TABLE_POINTS = 90; // 30 wins × 3 pts each

  try {
    const res = await fetch(sportUrl);
    if (!res.ok)
      throw new Error(`Failed to fetch NWSL standings from ${sportUrl}`);

    const data = await res.json();
    let teamStats = null;

    // ESPN NWSL standings can be flat or nested in children
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

    // Fallback: flat standings (no children)
    if (!teamStats && data.standings?.entries) {
      teamStats = data.standings.entries.find((t) => t.team.id === apiUniqueId);
    }

    if (!teamStats) {
      console.warn(`Could not find NWSL team ID ${apiUniqueId} in standings.`);
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    const pointsStat = teamStats.stats.find((s) => s.name === "points");
    const tablePoints = pointsStat ? pointsStat.value : 0;

    const regularSeasonScore = Math.min(
      Math.round((tablePoints / MAX_TABLE_POINTS) * 400),
      400,
    );

    // Postseason placeholder — will need manual override or future automation
    const postseasonScore = 0;

    return { regularSeasonScore, postseasonScore };
  } catch (error) {
    console.error("NWSL Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
