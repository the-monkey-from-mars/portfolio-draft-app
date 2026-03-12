export async function calculateF1(driverName) {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/v2/sports/racing/f1/standings",
    );
    if (!res.ok) throw new Error("Failed to fetch F1 standings");

    const data = await res.json();

    const standings = data.children?.[0]?.standings?.entries;
    if (!standings || standings.length === 0) {
      throw new Error("Could not parse F1 standings array.");
    }

    const leaderStat = standings[0].stats.find(
      (s) => s.name === "championshipPts",
    );
    const leaderPoints = leaderStat ? leaderStat.value : 0;
    const leaderName = standings[0].athlete?.displayName || "Unknown";

    if (leaderPoints === 0) {
      return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
    }

    const driverData = standings.find((d) => {
      if (!d.athlete) return false;
      const apiName = d.athlete.displayName.toLowerCase();
      const draftedName = driverName.toLowerCase();
      if (apiName === draftedName) return true;
      const draftedLastName = draftedName.split(" ").pop();
      if (apiName.includes(draftedLastName)) return true;
      return false;
    });

    if (!driverData) {
      console.warn(`Could not find F1 driver in standings: ${driverName}`);
      return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
    }

    const driverStat = driverData.stats.find(
      (s) => s.name === "championshipPts",
    );
    const driverPoints = driverStat ? driverStat.value : 0;

    const rankStat = driverData.stats.find(
      (s) => s.name === "rank" || s.name === "championshipRank",
    );
    const driverRank = rankStat ? rankStat.value : null;

    const regularSeasonScore = Math.round((driverPoints / leaderPoints) * 400);
    let postseasonScore = 0;

    const breakdown = {
      sportType: "f1_relative",
      regularSeason: {
        label: "WDC Points (Relative to Leader)",
        formula: "(driverPts / leaderPts) × 400",
        inputs: {
          driverPoints: driverPoints,
          leaderPoints: leaderPoints,
          leaderName: leaderName,
          driverRank: driverRank,
        },
        computed: regularSeasonScore,
        max: 400,
      },
      postseason: {
        label: "Crown Jewel Races (British, Belgian, Monaco, Italian GPs)",
        formula:
          "Points Finish (+15), Top 5 (+30), Podium (+45), Win (+60) — cumulative per race",
        milestones: [
          {
            label: "Monaco GP",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "British GP",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "Belgian GP",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "Italian GP",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
        ],
        computed: postseasonScore,
        max: 600,
      },
    };

    return { regularSeasonScore, postseasonScore, breakdown };
  } catch (error) {
    console.error("F1 Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}
