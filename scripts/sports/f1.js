export async function calculateF1(driverName) {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/v2/sports/racing/f1/standings",
    );
    if (!res.ok) throw new Error("Failed to fetch F1 standings");

    const data = await res.json();

    // Safety check for ESPN's standings array
    const standings = data.children?.[0]?.standings?.entries;
    if (!standings || standings.length === 0) {
      throw new Error("Could not parse F1 standings array.");
    }

    // 1. Find the World Championship Leader's Points (This is always index 0)
    const leaderStat = standings[0].stats.find((s) => s.name === "points");
    const leaderPoints = leaderStat ? leaderStat.value : 0;

    // If the season hasn't started and the leader has 0 points, avoid dividing by zero!
    if (leaderPoints === 0) {
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    // 2. Find your drafted driver with a Smart Fallback Matcher
    const driverData = standings.find((d) => {
      if (!d.athlete) return false;

      const apiName = d.athlete.displayName.toLowerCase();
      const draftedName = driverName.toLowerCase();

      // Attempt 1: Exact Match (e.g., "Max Verstappen" === "Max Verstappen")
      if (apiName === draftedName) return true;

      // Attempt 2: Last Name Fallback Match (e.g., "Kimi Antonelli" includes "Antonelli")
      const draftedLastName = draftedName.split(" ").pop();
      if (apiName.includes(draftedLastName)) return true;

      return false;
    });

    if (!driverData) {
      console.warn(`Could not find F1 driver in standings: ${driverName}`);
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    // 3. Extract your driver's points
    const driverStat = driverData.stats.find((s) => s.name === "points");
    const driverPoints = driverStat ? driverStat.value : 0;

    // 4. Apply the Portfolio Math: (Your Driver Pts / Leader Pts) * 400
    const regularSeasonScore = Math.round((driverPoints / leaderPoints) * 400);

    // Placeholder for the 4 Crown Jewel Races (+600 max)
    let postseasonScore = 0;

    return { regularSeasonScore, postseasonScore };
  } catch (error) {
    console.error("F1 Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
