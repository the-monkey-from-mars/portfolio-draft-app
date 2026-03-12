export async function calculateMMA(fighterName) {
  try {
    const currentYearFights = await fetchMMAFightLog(fighterName);

    let regularSeasonScore = 0;
    let postseasonScore = 0;

    const fightResults = [];

    for (const fight of currentYearFights) {
      const fightEntry = {
        result: fight.result,
        isMainEvent: fight.isMainEvent || false,
        isOpponentTop5: fight.isOpponentTop5 || false,
        isTitleFight: fight.isTitleFight || false,
        opponent: fight.opponent || "Unknown",
        regPoints: 0,
        bonusPoints: 0,
      };

      if (fight.result === "Win") {
        if (regularSeasonScore < 400) {
          const added = Math.min(200, 400 - regularSeasonScore);
          regularSeasonScore += added;
          fightEntry.regPoints = added;
        }

        let bonusPoints = 0;
        if (fight.isMainEvent) bonusPoints += 100;
        if (fight.isOpponentTop5) bonusPoints += 150;
        if (fight.isTitleFight) bonusPoints += 350;

        fightEntry.bonusPoints = bonusPoints;
        postseasonScore += bonusPoints;
      }

      fightResults.push(fightEntry);
    }

    postseasonScore = Math.min(postseasonScore, 600);

    const breakdown = {
      sportType: "mma_fight_log",
      regularSeason: {
        label: "Fight Wins (200 pts per Win, Max 400)",
        formula: "200 × wins (capped at 400)",
        inputs: {
          fights: fightResults,
          totalWins: fightResults.filter((f) => f.result === "Win").length,
          totalFights: fightResults.length,
        },
        computed: regularSeasonScore,
        max: 400,
      },
      postseason: {
        label: "High-Leverage Events",
        formula: "Main Event (+100), Top-5 Opponent (+150), Title Fight (+350)",
        milestones: [
          {
            label: "Main Event Bout",
            pts: 100,
            achieved: fightResults.some(
              (f) => f.result === "Win" && f.isMainEvent,
            ),
          },
          {
            label: "Win vs. Top-5 Opponent",
            pts: 150,
            achieved: fightResults.some(
              (f) => f.result === "Win" && f.isOpponentTop5,
            ),
          },
          {
            label: "Win Title Fight",
            pts: 350,
            achieved: fightResults.some(
              (f) => f.result === "Win" && f.isTitleFight,
            ),
          },
        ],
        computed: postseasonScore,
        max: 600,
      },
    };

    return { regularSeasonScore, postseasonScore, breakdown };
  } catch (error) {
    console.error(`MMA Script Error (${fighterName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}

async function fetchMMAFightLog(fighterName) {
  const mockDatabase = {
    "islam makhachev": [
      {
        result: "Win",
        opponent: "Arman Tsarukyan",
        isMainEvent: true,
        isOpponentTop5: true,
        isTitleFight: true,
      },
    ],
    "jon jones": [
      {
        result: "Win",
        opponent: "Stipe Miocic",
        isMainEvent: true,
        isOpponentTop5: false,
        isTitleFight: true,
      },
    ],
  };

  return mockDatabase[fighterName.toLowerCase()] || [];
}
