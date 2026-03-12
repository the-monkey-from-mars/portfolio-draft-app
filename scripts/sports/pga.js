import * as cheerio from "cheerio";

export async function calculatePGA(athleteName) {
  const url = "https://www.cbssports.com/golf/rankings/cup-points/";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });

    if (!res.ok)
      throw new Error(`Failed to fetch PGA standings from CBS Sports.`);

    const html = await res.text();
    const $ = cheerio.load(html);

    let leaderPoints = 0;
    let leaderName = "Unknown";
    let athletePoints = 0;
    let athleteRank = null;
    const athleteLastName = athleteName.split(" ").pop().toLowerCase();

    let pointsColIdx = -1;
    let playerColIdx = -1;

    $("thead th, tr.TableBase-headTr th").each((j, th) => {
      const headerText = $(th).text().toUpperCase().trim();
      if (headerText === "PTS" || headerText === "POINTS") pointsColIdx = j;
      if (headerText.includes("PLAYER")) playerColIdx = j;
    });

    $("tr.TableBase-bodyTr, tr").each((i, el) => {
      const cells = [];
      $(el)
        .find("td")
        .each((j, td) =>
          cells.push($(td).text().replace(/,/g, "").trim().toLowerCase()),
        );

      if (cells.length > 2) {
        const pIdx = pointsColIdx !== -1 ? pointsColIdx : cells.length - 1;
        const nameIdx = playerColIdx !== -1 ? playerColIdx : 1;

        const points = parseInt(cells[pIdx], 10);

        if (!isNaN(points) && points > 0) {
          if (leaderPoints === 0) {
            leaderPoints = points;
            if (cells[nameIdx]) leaderName = cells[nameIdx];
          }

          if (cells[nameIdx] && cells[nameIdx].includes(athleteLastName)) {
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
      sportType: "golf_relative",
      regularSeason: {
        label: "FedEx Cup Points (Relative to Leader)",
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
        label: "Major Championship Performance",
        formula:
          "Make Cut (+15), Top 10 (+30), Top 5 (+45), Win (+60) — cumulative per Major",
        milestones: [
          {
            label: "The Masters",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "PGA Championship",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "U.S. Open",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "The Open Championship",
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
    console.error(`Error calculating PGA (${athleteName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}
