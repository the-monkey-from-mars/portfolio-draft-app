export async function calculateSoccer(apiUniqueId, sportUrl, maxTablePoints) {
  try {
    const res = await fetch(sportUrl);
    if (!res.ok) throw new Error(`Failed to fetch from ${sportUrl}`);

    const data = await res.json();
    let teamStats = null;

    if (data.children && data.children.length > 0) {
      const standingsArray = data.children[0].standings.entries;
      const found = standingsArray.find((t) => t.team.id === apiUniqueId);
      if (found) {
        teamStats = found;
      }
    }

    if (!teamStats) {
      console.warn(
        `Could not find team ID ${apiUniqueId} in current soccer standings.`,
      );
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    const pointsStat = teamStats.stats.find((s) => s.name === "points");
    const tablePoints = pointsStat ? pointsStat.value : 0;
    const regularSeasonScore = Math.round((tablePoints / maxTablePoints) * 400);

    return { regularSeasonScore, postseasonScore: 0 };
  } catch (error) {
    console.error("Soccer Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
