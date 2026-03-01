import * as cheerio from "cheerio";

export async function calculateLPGA(athleteName) {
  const statsUrl = "https://www.lpga.com/stats-and-rankings/race-to-cme-globe/";

  try {
    // --- STEP 1: Get leader points from the stats overview page (no Cloudflare) ---
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
    let athletePoints = 0;
    let athleteSlug = null; // e.g. "lydia-ko/98109"

    // The CME Globe overview page lists the top ~15 players with links and points.
    // Each player appears TWICE (featured card + list), so we deduplicate by athlete ID.
    const seenIds = new Set();

    $("a[href*='/athletes/']").each((i, el) => {
      const href = $(el).attr("href") || "";

      // Extract athlete slug and ID: "/athletes/lydia-ko/98109/overview"
      const slugMatch = href.match(/\/athletes\/([^/]+)\/(\d+)\//);
      if (!slugMatch) return;
      const slugName = slugMatch[1].replace(/-/g, " ").toLowerCase();
      const athleteId = slugMatch[2];

      // Skip duplicates (the page renders each athlete twice)
      if (seenIds.has(athleteId)) return;

      // Points appear as a sibling text node or nearby element — parse the full section text
      const section = $(el)
        .closest("div, li")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      // Extract points: a number like "595.000" or "312.500"
      const pointsMatch = section.match(/(\d{1,4}\.\d{3})/);
      if (!pointsMatch) return;
      const points = parseFloat(pointsMatch[1]);
      if (isNaN(points) || points <= 0) return;

      seenIds.add(athleteId);

      if (leaderPoints === 0) {
        leaderPoints = points;
        console.log(`[LPGA] Leader: "${slugName}" @ ${points} pts`);
      }

      // Match athlete by name — multiple strategies for robustness
      const isMatch =
        athleteFullName === slugName ||
        athleteFullName.includes(slugName) ||
        slugName.includes(athleteFullName) ||
        // Collapsed comparison: "somilee" vs "somilee" for Korean names with spacing variations
        athleteFullName.replace(/\s/g, "") === slugName.replace(/\s/g, "");

      if (isMatch) {
        athletePoints = points;
        athleteSlug = href.replace("/athletes/", "").replace("/overview", "");
        console.log(
          `[LPGA] Matched "${athleteName}" → "${slugName}" (ID: ${athleteId}) @ ${points} pts`,
        );
      }
    });

    // --- STEP 2: If athlete not in top 5, look up their individual athlete page ---
    if (leaderPoints > 0 && athletePoints === 0) {
      console.log(
        `[LPGA] ${athleteName} not in top 15 on CME overview, fetching individual athlete page...`,
      );

      // Build slug from name: "Lydia Ko" → "lydia-ko"
      const nameSlug = athleteName.trim().toLowerCase().replace(/\s+/g, "-");
      const searchUrl = `https://www.lpga.com/athletes/${nameSlug}/overview`;

      // We don't know the numeric ID, so search for it
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

        // Find the athlete's profile link to get their numeric ID
        $s("a[href*='/athletes/']").each((i, el) => {
          const href = $s(el).attr("href") || "";
          const slugMatch = href.match(/\/athletes\/([^/]+)\/overview/);
          if (!slugMatch) return;
          const slug = slugMatch[1];
          if (slug.includes(nameSlug.split("-")[1])) {
            // match on last name
            athleteSlug = slug;
          }
        });
      }

      // Fetch athlete's overview page to get their CME points
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
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    const regularSeasonScore = Math.min(
      Math.round((athletePoints / leaderPoints) * 400),
      400,
    );
    return { regularSeasonScore, postseasonScore: 0 };
  } catch (error) {
    console.error(`Error calculating LPGA (${athleteName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
