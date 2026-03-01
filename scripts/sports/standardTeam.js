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
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    let regularSeasonScore = 0;

    // --- NHL LOGIC (Points based: Max 164 points) ---
    if (sportUrl.includes("nhl")) {
      const pointsStat = teamStats.stats.find((s) => s.name === "points");
      const tablePoints = pointsStat ? pointsStat.value : 0;
      regularSeasonScore = Math.round((tablePoints / 164) * 400);
    }
    // --- STANDARD LOGIC (Win % based) ---
    else {
      const winPercentStat = teamStats.stats.find(
        (s) => s.name === "winPercent",
      );
      const winPercent = winPercentStat ? winPercentStat.value : 0;
      regularSeasonScore = Math.round(winPercent * 400);
    }

    return { regularSeasonScore, postseasonScore: 0 };
  } catch (error) {
    console.error("Standard Team Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
