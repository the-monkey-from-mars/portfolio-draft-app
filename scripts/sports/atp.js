import * as cheerio from "cheerio";

export async function calculateATP(athleteName) {
  const url = "https://live-tennis.eu/en/atp-race";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });

    if (!res.ok) throw new Error(`Failed to fetch ATP standings`);

    const html = await res.text();
    const $ = cheerio.load(html);

    let leaderPoints = 0;
    let athletePoints = 0;

    // We split the name to grab the last name (e.g., "Felix Auger-Aliassime" becomes "auger-aliassime")
    const athleteLastName = athleteName.split(" ").pop().toLowerCase();

    $("tr").each((i, el) => {
      const cells = [];
      $(el)
        .find("td")
        .each((j, td) =>
          cells.push($(td).text().replace(/,/g, "").trim().toLowerCase()),
        );

      // Ensure the row has at least 6 columns (Index 5 = Points)
      if (cells.length >= 6) {
        // Pure Array Indexing: We know Points are exactly in the 6th column
        const points = parseInt(cells[5], 10);

        if (!isNaN(points) && points > 0) {
          // The FIRST row with valid points is mathematically the #1 Leader
          if (leaderPoints === 0) {
            leaderPoints = points;
          }

          // Check ONLY the first 4 columns for the name.
          // This absolutely prevents the "Next Player" bug on the right side.
          const isOurAthlete = cells
            .slice(0, 4)
            .some((cellText) => cellText.includes(athleteLastName));

          if (isOurAthlete) {
            athletePoints = points;
          }
        }
      }
    });

    if (leaderPoints === 0 || athletePoints === 0) {
      console.warn(
        `[${athleteName}] Check failed. Pts: ${athletePoints}, Leader: ${leaderPoints}`,
      );
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    const regularSeasonScore = Math.min(
      Math.round((athletePoints / leaderPoints) * 400),
      400,
    );
    return { regularSeasonScore, postseasonScore: 0 };
  } catch (error) {
    console.error(`Error calculating ATP (${athleteName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
