export async function calculateSummerIntl(apiUniqueId, espnSlug) {
  try {
    const slugs = Array.isArray(espnSlug) ? espnSlug : [espnSlug];

    let teamStats = null;

    for (const slug of slugs) {
      const url = `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(
          `Failed to fetch standings for ${slug}: HTTP ${res.status}`,
        );
        continue;
      }

      const data = await res.json();

      if (data.children && data.children.length > 0) {
        for (const group of data.children) {
          const entries = group.standings?.entries || [];
          const found = entries.find((t) => t.team.id === apiUniqueId);
          if (found) {
            teamStats = found;
            break;
          }
        }
      }

      if (!teamStats && data.standings?.entries) {
        teamStats = data.standings.entries.find(
          (t) => t.team.id === apiUniqueId,
        );
      }

      if (teamStats) break;
    }

    if (!teamStats) {
      console.warn(
        `Could not find team ID ${apiUniqueId} in summer intl soccer standings.`,
      );
      return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
    }

    const winsStat = teamStats.stats.find((s) => s.name === "wins");
    const drawsStat = teamStats.stats.find((s) => s.name === "ties");
    const lossesStat = teamStats.stats.find((s) => s.name === "losses");
    const groupPosStat = teamStats.stats.find(
      (s) => s.name === "rank" || s.name === "groupRank",
    );

    const wins = winsStat ? winsStat.value : 0;
    const draws = drawsStat ? drawsStat.value : 0;
    const losses = lossesStat ? lossesStat.value : 0;
    const groupRank = groupPosStat ? groupPosStat.value : 99;

    let regularSeasonScore = wins * 100 + draws * 35;
    const isGroupWinner = groupRank === 1;

    if (isGroupWinner) {
      regularSeasonScore += 100;
    }

    regularSeasonScore = Math.min(regularSeasonScore, 400);

    const postseasonScore = 0;

    const breakdown = {
      sportType: "intl_soccer_tournament",
      regularSeason: {
        label: "Group Stage",
        formula: "(wins × 100) + (draws × 35) + (group winner bonus: 100)",
        inputs: {
          wins: wins,
          draws: draws,
          losses: losses,
          groupRank: groupRank,
          isGroupWinner: isGroupWinner,
          groupWinnerBonus: isGroupWinner ? 100 : 0,
        },
        computed: regularSeasonScore,
        max: 400,
      },
      postseason: {
        label: "Knockout Stage",
        formula: "Cumulative knockout round bonuses",
        milestones: [
          { label: "Round of 32 Win", pts: 50, achieved: false },
          { label: "Round of 16 Win", pts: 75, achieved: false },
          { label: "Quarterfinal Win", pts: 100, achieved: false },
          { label: "Semifinal Win", pts: 125, achieved: false },
          { label: "Win the Final", pts: 250, achieved: false },
        ],
        computed: postseasonScore,
        max: 600,
      },
    };

    return { regularSeasonScore, postseasonScore, breakdown };
  } catch (error) {
    console.error("Summer Intl Soccer Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}
