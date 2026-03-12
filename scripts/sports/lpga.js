import * as cheerio from "cheerio";

export async function calculateLPGA(athleteName) {
  const statsUrl = "https://www.lpga.com/stats-and-rankings/race-to-cme-globe/";

  try {
    const statsRes = await fetch(statsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });

    if (!statsRes.ok)
      throw new Error(`Failed to fetch LPGA stats: HTTP ${statsRes.status}`);

    const statsHtml = await statsRes.text();
    const $ = cheerio.load(statsHtml);

    const athleteFullName = athleteName
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    let leaderPoints = 0;
    let leaderName = "Unknown";
    let athletePoints = 0;
    let athleteSlug = null;

    const seenIds = new Set();

    $("a[href*='/athletes/']").each((i, el) => {
      const href = $(el).attr("href") || "";

      const slugMatch = href.match(/\/athletes\/([^/]+)\/(\d+)\//);
      if (!slugMatch) return;
      const slugName = slugMatch[1].replace(/-/g, " ").toLowerCase();
      const athleteId = slugMatch[2];

      if (seenIds.has(athleteId)) return;

      const section = $(el)
        .closest("div, li")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const pointsMatch = section.match(/(\d{1,4}\.\d{3})/);
      if (!pointsMatch) return;
      const points = parseFloat(pointsMatch[1]);
      if (isNaN(points) || points <= 0) return;

      seenIds.add(athleteId);

      if (leaderPoints === 0) {
        leaderPoints = points;
        leaderName = slugName;
        console.log(`[LPGA] Leader: "${slugName}" @ ${points} pts`);
      }

      const isMatch =
        athleteFullName === slugName ||
        athleteFullName.includes(slugName) ||
        slugName.includes(athleteFullName) ||
        athleteFullName.replace(/\s/g, "") === slugName.replace(/\s/g, "");

      if (isMatch) {
        athletePoints = points;
        athleteSlug = href.replace("/athletes/", "").replace("/overview", "");
        console.log(
          `[LPGA] Matched "${athleteName}" → "${slugName}" (ID: ${athleteId}) @ ${points} pts`,
        );
      }
    });

    // --- STEP 2: If athlete not in top listing, look up their individual page ---
    if (leaderPoints > 0 && athletePoints === 0) {
      console.log(
        `[LPGA] ${athleteName} not in top 15 on CME overview, fetching individual athlete page...`,
      );

      const nameSlug = athleteName.trim().toLowerCase().replace(/\s+/g, "-");

      const searchRes = await fetch(
        `https://www.lpga.com/athletes?q=${encodeURIComponent(athleteName)}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html",
          },
        },
      );

      if (searchRes.ok) {
        const searchHtml = await searchRes.text();
        const $s = cheerio.load(searchHtml);

        $s("a[href*='/athletes/']").each((i, el) => {
          const href = $s(el).attr("href") || "";
          const slugMatch = href.match(/\/athletes\/([^/]+)\/overview/);
          if (!slugMatch) return;
          const slug = slugMatch[1];
          if (slug.includes(nameSlug.split("-")[1])) {
            athleteSlug = slug;
          }
        });
      }

      if (athleteSlug) {
        const athleteRes = await fetch(
          `https://www.lpga.com/athletes/${athleteSlug}/overview`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
              Accept: "text/html",
            },
          },
        );

        if (athleteRes.ok) {
          const athleteHtml = await athleteRes.text();
          const $a = cheerio.load(athleteHtml);
          const cmeText = $a("*")
            .filter((i, el) => {
              return (
                $a(el).text().includes("CME") || $a(el).text().includes("Race")
              );
            })
            .text();
          const cmeMatch = cmeText.match(/(\d{1,4}\.\d{3})/);
          if (cmeMatch) {
            athletePoints = parseFloat(cmeMatch[1]);
            console.log(
              `[LPGA] Athlete found via profile: "${athleteName}" @ ${athletePoints} pts`,
            );
          }
        }
      }
    }

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
        label: "Race to CME Globe Points (Relative to Leader)",
        formula: "(athletePts / leaderPts) × 400",
        inputs: {
          athletePoints: athletePoints,
          leaderPoints: leaderPoints,
          leaderName: leaderName,
          athleteRank: null,
        },
        computed: regularSeasonScore,
        max: 400,
      },
      postseason: {
        label: "Major Championship Performance",
        formula:
          "Make Cut (+12), Top 10 (+24), Top 5 (+36), Win (+48) — cumulative per Major",
        milestones: [
          {
            label: "Chevron Championship",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "KPMG Women's PGA",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "U.S. Women's Open",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "The Evian Championship",
            pts: 0,
            achieved: false,
            detail: "Not yet scored",
          },
          {
            label: "AIG Women's Open",
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
    console.error(`Error calculating LPGA (${athleteName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0, breakdown: null };
  }
}
