import * as cheerio from "cheerio";

export async function calculateWTA(athleteName) {
  const url = "https://live-tennis.eu/en/wta-race";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });

    if (!res.ok) throw new Error(`Failed to fetch WTA standings`);

    const html = await res.text();
    const $ = cheerio.load(html);

    let leaderPoints = 0;
    let leaderName = "Unknown";
    let athletePoints = 0;
    let athleteRank = null;
    const athleteLastName = athleteName.split(" ").pop().toLowerCase();

    $("tr").each((i, el) => {
      const cells = [];
      $(el)
        .find("td")
        .each((j, td) =>
          cells.push($(td).text().replace(/,/g, "").trim().toLowerCase()),
        );

      if (cells.length >= 6) {
        const points = parseInt(cells[5], 10);

        if (!isNaN(points) && points > 0) {
          if (leaderPoints === 0) {
            leaderPoints = points;
            const nameCell = cells.slice(1, 4).find((c) => c.match(/[a-z]/));
            if (nameCell) leaderName = nameCell;
          }

          const isOurAthlete = cells
            .slice(0, 4)
            .some((cellText) => cellText.includes(athleteLastName));

          if (isOurAthlete) {
            athletePoints = points;
            const rank = parseInt(cells[0], 10);
            if (!isNaN(rank)) athleteRank = rank;
          }
        }
      }
    });

    if (leaderPoints === 0 || athletePoints === 0) {
      console.warn(
        `[${athleteName}] Check failed. Pts: ${athletePoints}, Leader: ${leaderPoints}`,
      );
      return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
    }

    const regularSeasonScore = Math.min(
      Math.round((athletePoints / leaderPoints) * 400),
      400,
    );

    const breakdown = {
      sportType: "tennis_relative",
      regularSeason: {
        label: "WTA Race Points (Relative to Leader)",
        formula: "(athletePts / leaderPts) × 400",
        inputs: {
          athletePoints: athletePoints,
          leaderPoints: leaderPoints,
          leaderName: leaderName,
          athleteRank: athleteRank,
        },
        computed: regularSeasonScore,
        max: 400,
      },
      postseason: {
        label: "Grand Slam Performance",
        formula:
          "Rd32 (+3.6), Rd16 (+7.1), QF (+14.3), SF (+28.6), Final (+39.2), Win (+57.2) — cumulative per Major",
        milestones: [
          {
            label: "Australian Open",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "French Open",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "Wimbledon",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "US Open",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
        ],
        computed: 0,
        max: 600,
      },
    };

    return { regularSeasonScore, postseasonScore: 0, breakdown };
  } catch (error) {
    console.error(`Error calculating WTA (${athleteName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}
