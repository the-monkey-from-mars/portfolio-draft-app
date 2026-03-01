export async function calculateMMA(fighterName) {
  try {
    // In a fully automated world, we would fetch a fight database here.
    // Because specific metadata (Title Fight, Top 5 Opponent) is rarely free via API,
    // this data would ideally be fetched from a custom Supabase table you update after PPVs.

    // For demonstration, let's simulate fetching a fighter's record for the current year:
    const currentYearFights = await fetchMMAFightLog(fighterName);

    let regularSeasonScore = 0;
    let postseasonScore = 0;

    for (const fight of currentYearFights) {
      if (fight.result === "Win") {
        // 1. Regular Season Points (Max 400)
        // +200 per win. Capped at 400.
        if (regularSeasonScore < 400) {
          regularSeasonScore += 200;
        }

        // 2. High-Leverage Bonus Points (Max 600)
        // Note: These bonuses stack based on your ruleset, but cap at 600.
        let bonusPoints = 0;

        if (fight.isMainEvent) bonusPoints += 100;
        if (fight.isOpponentTop5) bonusPoints += 150;
        if (fight.isTitleFight) bonusPoints += 350;

        postseasonScore += bonusPoints;
      }
    }

    // Ensure the high-leverage points never exceed the 600 point maximum
    postseasonScore = Math.min(postseasonScore, 600);

    return { regularSeasonScore, postseasonScore };
  } catch (error) {
    console.error(`MMA Script Error (${fighterName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}

// --- HELPER FUNCTION (Mock Data Fetcher) ---
// To make this fully functional, we would connect this to a Supabase table
// called `mma_results` where you can quickly log wins after a UFC event.
async function fetchMMAFightLog(fighterName) {
  // Example of what the data structure needs to look like for the math engine:
  const mockDatabase = {
    "islam makhachev": [
      {
        result: "Win",
        isMainEvent: true,
        isOpponentTop5: true,
        isTitleFight: true,
      },
      // Math: 200 (Reg) + 100 + 150 + 350 = 600 (Post). Total: 800 pts.
    ],
    "jon jones": [
      {
        result: "Win",
        isMainEvent: true,
        isOpponentTop5: false,
        isTitleFight: true,
      },
      // Math: 200 (Reg) + 100 + 0 + 350 = 450 (Post). Total: 650 pts.
    ],
  };

  return mockDatabase[fighterName.toLowerCase()] || [];
}
