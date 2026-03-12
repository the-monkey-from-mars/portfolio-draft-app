export async function calculateSoccer(apiUniqueId, sportUrl, maxTablePoints) {
  try {
    const res = await fetch(sportUrl);
    if (!res.ok) throw new Error(`Failed to fetch from ${sportUrl}`);

    const data = await res.json();
    let teamStats = null;

    if (data.children && data.children.length > 0) {
      for (const conference of data.children) {
        const standingsArray = conference.standings.entries;
        const found = standingsArray.find((t) => t.team.id === apiUniqueId);
        if (found) {
          teamStats = found;
          break;
        }
      }
    }

    if (!teamStats) {
      console.warn(
        `Could not find team ID ${apiUniqueId} in current soccer standings.`,
      );
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
    const goalDiffStat = teamStats.stats.find(
      (s) => s.name === "pointDifferential" || s.name === "goalDifference",
    );

    const regularSeasonScore = Math.round((tablePoints / maxTablePoints) * 400);

    const isMLS = sportUrl.includes("usa.1");
    const isPL = sportUrl.includes("eng.1");

    let postMilestones = [];

    if (isMLS) {
      postMilestones = [
        { label: "Make Playoffs", pts: 60, achieved: false },
        { label: "Advance to Round 2", pts: 90, achieved: false },
        { label: "Conference Finals", pts: 120, achieved: false },
        { label: "MLS Cup Finals", pts: 150, achieved: false },
        { label: "Win MLS Cup", pts: 180, achieved: false },
      ];
    } else if (isPL) {
      postMilestones = [
        { label: "UCL: Advance to Knockouts", pts: 20, achieved: false },
        { label: "UCL: Quarterfinals", pts: 35, achieved: false },
        { label: "UCL: Semifinals", pts: 55, achieved: false },
        { label: "UCL: Finals", pts: 80, achieved: false },
        { label: "UCL: Win", pts: 105, achieved: false },
        { label: "FA Cup: Quarterfinals", pts: 20, achieved: false },
        { label: "FA Cup: Semifinals", pts: 35, achieved: false },
        { label: "FA Cup: Final", pts: 55, achieved: false },
        { label: "FA Cup: Win", pts: 80, achieved: false },
        { label: "Carabao Cup: Quarterfinals", pts: 10, achieved: false },
        { label: "Carabao Cup: Semifinals", pts: 20, achieved: false },
        { label: "Carabao Cup: Final", pts: 35, achieved: false },
        { label: "Carabao Cup: Win", pts: 50, achieved: false },
      ];
    }

    const breakdown = {
      sportType: "soccer_table",
      regularSeason: {
        label: "Table Points",
        formula: `(tablePoints / ${maxTablePoints}) × 400`,
        inputs: {
          wins: winsStat ? winsStat.value : 0,
          draws: drawsStat ? drawsStat.value : 0,
          losses: lossesStat ? lossesStat.value : 0,
          gamesPlayed: gpStat ? gpStat.value : 0,
          goalDifference: goalDiffStat ? goalDiffStat.value : 0,
          tablePoints: tablePoints,
          maxTablePoints: maxTablePoints,
        },
        computed: regularSeasonScore,
        max: 400,
      },
      postseason: {
        label: isPL ? "Cups & European Play" : "MLS Cup Playoffs",
        formula: "Cumulative bracket bonuses",
        milestones: postMilestones,
        computed: 0,
        max: 600,
      },
    };

    return { regularSeasonScore, postseasonScore: 0, breakdown };
  } catch (error) {
    console.error("Soccer Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}
