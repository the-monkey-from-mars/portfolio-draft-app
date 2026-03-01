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
    let athletePoints = 0;
    const athleteLastName = athleteName.split(" ").pop().toLowerCase();

    let pointsColIdx = -1;
    let playerColIdx = -1;

    // Auto-detect which columns contain "PTS" and "PLAYER"
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
        // Fallback to assumptions if column headers weren't found perfectly
        const pIdx = pointsColIdx !== -1 ? pointsColIdx : cells.length - 1;
        const nameIdx = playerColIdx !== -1 ? playerColIdx : 1;

        const points = parseInt(cells[pIdx], 10);

        if (!isNaN(points) && points > 0) {
          if (leaderPoints === 0) leaderPoints = points;

          if (cells[nameIdx] && cells[nameIdx].includes(athleteLastName)) {
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
    console.error(`Error calculating PGA (${athleteName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
