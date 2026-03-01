import * as cheerio from "cheerio";

/**
 * LOVB Score Calculator
 *
 * Scrapes https://www.lovb.com/{year}/standings for regular season W-L data,
 * and https://www.lovb.com/{year}/schedule for postseason match results.
 *
 * Scoring:
 *   regularSeasonScore = Math.round(winPct * 400)   (0–400 points)
 *   postseasonScore    = postseasonWins * 100        (100 pts per playoff W)
 *
 * Architecture:
 *   The standings page is a Next.js app. We use three strategies in priority order:
 *     1. Parse __NEXT_DATA__ JSON (most reliable when present)
 *     2. Parse the structured HTML table columns (W/L are in a "Summary" section)
 *     3. Parse the flattened rendered text using positional patterns
 *   For postseason, we scrape the schedule page for completed playoff matches.
 */

// ---------- CONFIGURATION ----------

// Dynamically determine the current LOVB season year.
// LOVB seasons run Jan–Apr, so if we're in Jan–Jun we use the current year,
// otherwise the next year (preseason starts in fall).
function getCurrentSeasonYear() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  // If we're in July–December, next year's season is either upcoming or in preseason
  return month >= 6 ? year + 1 : year;
}

const LOVB_TEAMS = [
  "salt lake",
  "houston",
  "austin",
  "atlanta",
  "nebraska",
  "madison",
];

// ---------- FETCH HELPERS ----------

async function fetchPageHTML(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  return res.text();
}

// ---------- STRATEGY 1: __NEXT_DATA__ JSON ----------

function parseFromNextData(html, cleanTeamName) {
  const $ = cheerio.load(html);
  const nextDataScript = $("#__NEXT_DATA__").html();
  if (!nextDataScript) return null;

  let jsonData;
  try {
    jsonData = JSON.parse(nextDataScript);
  } catch {
    return null;
  }

  // Strategy 1a: Look for a standings array with team objects containing wins/losses
  let teamStats = null;

  const searchJSON = (obj, depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 15 || teamStats) return;

    // Check if this object directly has wins + losses + a name-like field
    if (typeof obj.wins === "number" && typeof obj.losses === "number") {
      // Check various possible name fields
      const nameFields = [
        "name",
        "teamName",
        "team_name",
        "displayName",
        "city",
        "location",
        "slug",
        "abbreviation",
      ];
      for (const field of nameFields) {
        if (
          typeof obj[field] === "string" &&
          obj[field].toLowerCase().includes(cleanTeamName)
        ) {
          teamStats = { wins: obj.wins, losses: obj.losses };
          return;
        }
      }

      // Also check if the whole object stringified contains the team name
      // (handles nested name structures)
      try {
        const str = JSON.stringify(obj).toLowerCase();
        if (str.includes(cleanTeamName) && str.length < 5000) {
          teamStats = { wins: obj.wins, losses: obj.losses };
          return;
        }
      } catch {
        // circular reference or too deep, skip
      }
    }

    // Recurse into children
    for (const val of Object.values(obj)) {
      if (teamStats) return;
      searchJSON(val, depth + 1);
    }
  };

  searchJSON(jsonData);
  return teamStats; // { wins, losses } or null
}

// ---------- STRATEGY 2: Structured HTML Table ----------

function parseFromHTMLTable(html, cleanTeamName) {
  const $ = cheerio.load(html);

  // The LOVB standings page has team links like /teams/lovb-{city}-volleyball
  // followed by structured data columns. We look for table rows or divs
  // that contain team data.

  // Approach: Find all elements that link to a team page, then look for
  // nearby sibling/parent elements with W-L data.

  // First, try to find a proper table structure
  const tables = $("table");
  for (let t = 0; t < tables.length; t++) {
    const rows = $(tables[t]).find("tr");
    for (let r = 0; r < rows.length; r++) {
      const rowText = $(rows[r]).text().toLowerCase();
      if (rowText.includes(cleanTeamName)) {
        const cells = $(rows[r]).find("td, th");
        const cellValues = [];
        cells.each((_, cell) => {
          cellValues.push($(cell).text().trim());
        });

        // Look for W and L columns (typically after team name and MP)
        // Pattern: [rank, team, MP, W, L, ...]
        const nums = cellValues
          .map((v) => parseInt(v, 10))
          .filter((n) => !isNaN(n));
        if (nums.length >= 3) {
          // nums[0] might be rank or MP, nums[1] could be MP or W, etc.
          // We look for a plausible W-L pair
          for (let i = 0; i < nums.length - 1; i++) {
            const w = nums[i];
            const l = nums[i + 1];
            if (w + l > 0 && w + l <= 30 && w >= 0 && l >= 0) {
              return { wins: w, losses: l };
            }
          }
        }
      }
    }
  }

  return null;
}

// ---------- STRATEGY 3: Positional Text Parsing ----------
// This is the most resilient fallback. The rendered page text from the
// standings page follows a very specific pattern observed from actual fetches:
//
// The team names appear in order (positions 1-6), followed by MP values for
// all teams, then a "Summary" section header, then "W", "L", "Sets", "Pts"
// headers, and then the actual W values for all 6 teams, then L values for
// all 6 teams, then Sets, then Pts.
//
// So for team at position N (0-indexed): W = wValues[N], L = lValues[N]

function parseFromRenderedText(html, cleanTeamName) {
  const $ = cheerio.load(html);
  const bodyText = $("body").text();

  // Step 1: Identify the team ordering by finding all LOVB team links
  const teamOrder = [];
  $('a[href*="/teams/lovb-"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    // Extract city from /teams/lovb-{city}-volleyball
    const match = href.match(/\/teams\/lovb-([a-z-]+)-volleyball/);
    if (match) {
      const city = match[1].replace(/-/g, " "); // "salt-lake" → "salt lake"
      if (!teamOrder.includes(city)) {
        teamOrder.push(city);
      }
    }
  });

  if (teamOrder.length === 0) {
    // Fallback: try to find teams from the text itself
    for (const team of LOVB_TEAMS) {
      if (bodyText.toLowerCase().includes(`lovb ${team}`)) {
        teamOrder.push(team);
      }
    }
  }

  const teamIndex = teamOrder.findIndex((t) => t.includes(cleanTeamName));
  if (teamIndex === -1) return null;

  // Step 2: Find the "Summary" section and extract W/L values
  // The pattern in the rendered text is:
  //   ...Summary\n\nW\n\nL\n\nSets\n\nPts\n\n{W1}\n\n{L1}\n\n{Sets1}\n\n{Pts1}\n\n{W2}...
  //
  // But actually from our observations, after "W" "L" "Sets" "Pts" headers,
  // the data comes as: W1 L1 Sets1 Pts1 W2 L2 Sets2 Pts2 ... (row by row per team)
  //
  // OR it might be columnar: W1 W2 W3 W4 W5 W6 L1 L2 L3 L4 L5 L6 ...
  //
  // Let's analyze the actual text to determine the pattern.

  // Extract the section between "Summary" and "Location" (or "Home")
  const summaryMatch = bodyText.match(
    /Summary[\s\S]*?(?:W\s+L\s+Sets\s+Pts)([\s\S]*?)(?:Location|Home|Away)/i,
  );
  if (!summaryMatch) {
    // Try alternative: just find all numbers after "Pts" header
    return parseFromFlatNumbers(bodyText, cleanTeamName, teamOrder, teamIndex);
  }

  const dataSection = summaryMatch[1];

  // Extract all standalone numbers and "X - Y" patterns from this section
  const tokens = [];
  // Match either "X - Y" patterns (sets/points) or standalone numbers
  const tokenRegex = /(\d+\s*-\s*\d+)|(\b\d+\b)/g;
  let tokenMatch;
  while ((tokenMatch = tokenRegex.exec(dataSection)) !== null) {
    if (tokenMatch[1]) {
      // This is a "X - Y" pattern (sets or points) — treat as one token
      tokens.push(tokenMatch[1].trim());
    } else {
      tokens.push(parseInt(tokenMatch[2], 10));
    }
  }

  // The data is organized per team in the standings order.
  // Each team has 4 data points: W (number), L (number), Sets ("X - Y"), Pts ("X - Y")
  // For 6 teams that's 24 tokens total.
  const numTeams = teamOrder.length;

  // Check if data appears to be columnar (all W values, then all L values, etc.)
  // or row-based (W1, L1, Sets1, Pts1, W2, L2, Sets2, Pts2, ...)
  //
  // From our actual observation, the plain text renders as:
  // 8 3 26 - 15 925 - 848 7 5 26 - 19 1034 - 982 ...
  // This is ROW-BASED: each team's data is [W, L, Sets, Pts] in sequence.

  // Try row-based interpretation first
  if (tokens.length >= numTeams * 4) {
    const teamData = [];
    let idx = 0;
    for (let i = 0; i < numTeams; i++) {
      const w = tokens[idx];
      const l = tokens[idx + 1];
      // tokens[idx+2] and [idx+3] are Sets and Pts strings
      teamData.push({
        wins: typeof w === "number" ? w : parseInt(w, 10),
        losses: typeof l === "number" ? l : parseInt(l, 10),
      });
      idx += 4; // skip W, L, Sets, Pts
    }

    if (teamIndex < teamData.length) {
      const result = teamData[teamIndex];
      if (!isNaN(result.wins) && !isNaN(result.losses)) {
        return result;
      }
    }
  }

  // Try columnar interpretation as fallback
  const justNumbers = tokens.filter((t) => typeof t === "number");
  if (justNumbers.length >= numTeams * 2) {
    // First N numbers are wins, next N are losses
    const wins = justNumbers[teamIndex];
    const losses = justNumbers[teamIndex + numTeams];
    if (
      wins !== undefined &&
      losses !== undefined &&
      wins + losses > 0 &&
      wins + losses <= 30
    ) {
      return { wins, losses };
    }
  }

  return null;
}

// ---------- STRATEGY 3b: Flat number extraction ----------

function parseFromFlatNumbers(bodyText, cleanTeamName, teamOrder, teamIndex) {
  // Last resort: find the team name in the text and look for nearby numbers
  // that could be W-L record.

  const text = bodyText.toLowerCase();
  const teamPos = text.indexOf(`lovb ${cleanTeamName}`);
  if (teamPos === -1) return null;

  // Look in a window after the team name for the pattern
  // The numbers near each team in various sections could be:
  // rank, MP, W, L, etc.
  // We'll look for all numbers within 200 chars after the team name
  const window = text.substring(teamPos, teamPos + 300);
  const nums = [...window.matchAll(/\b(\d+)\b/g)].map((m) =>
    parseInt(m[1], 10),
  );

  // Filter to plausible W-L pairs
  for (let i = 0; i < nums.length - 1; i++) {
    const w = nums[i];
    const l = nums[i + 1];
    // A W-L pair where total games is between 1 and 25 (LOVB plays 20 regular season matches)
    if (w + l > 0 && w + l <= 25 && w >= 0 && l >= 0) {
      // Additional check: skip if this looks like a rank (1) followed by MP
      if (i === 0 && w <= 6 && l <= 20 && l > w) {
        // This might be [rank, MP] — skip to next pair
        continue;
      }
      return { wins: w, losses: l };
    }
  }

  return null;
}

// ---------- POSTSEASON SCRAPER ----------

async function getPostseasonWins(teamName, seasonYear) {
  try {
    const scheduleUrl = `https://www.lovb.com/${seasonYear}/schedule`;
    const html = await fetchPageHTML(scheduleUrl);
    const $ = cheerio.load(html);
    const bodyText = $("body").text();

    // The 2026 postseason format: Semifinals (April 9-11) and Championship.
    // On the schedule page, postseason matches would appear after the regular season.
    // We look for match results in April that are labeled as playoffs/semifinals/finals,
    // or that occur in the known postseason date range.

    // The schedule page shows completed matches with set scores like:
    //   "LOVB Austin" "LOVB Nebraska" "25 20 25 22 9" "2" "22 25 22 25 15" "3"
    // where the last numbers (2 and 3) represent sets won.

    // Strategy: Find all links containing the team's slug that appear to be
    // postseason matches (by date or section labeling).

    const cleanName = teamName.replace("LOVB ", "").toLowerCase();
    const teamSlug = `lovb-${cleanName.replace(/ /g, "-")}-volleyball`;

    let postseasonWins = 0;

    // Look for postseason section markers
    const pageText = bodyText.toLowerCase();
    const postseasonKeywords = [
      "semifinal",
      "semi-final",
      "championship",
      "final",
      "playoff",
      "postseason",
    ];

    const hasPostseason = postseasonKeywords.some((kw) =>
      pageText.includes(kw),
    );

    if (!hasPostseason) {
      // No postseason section found — season still in regular season
      console.log(
        `ℹ️ No postseason data found yet for LOVB ${seasonYear} season.`,
      );
      return 0;
    }

    // If postseason exists, find the section and look for completed matches
    // involving our team. A "win" means the team's set score is higher.
    //
    // The schedule page structure shows matches with set scores.
    // We look for match links that include playoff/semifinal/final labels
    // and contain our team's slug, then determine if our team won.

    // Parse match results from the schedule page
    // Each match on the schedule shows as a link pair (two teams) followed by set scores
    // The scores appear as individual set scores followed by total sets won

    // Look for match sections that appear to be in April (postseason month)
    // or are explicitly labeled as postseason

    // Find all schedule entries that contain our team
    const matchLinks = $('a[href*="/schedule/"]');
    const processedMatches = new Set();

    matchLinks.each((_, el) => {
      const href = $(el).attr("href") || "";

      // Skip if not a match link (must have a UUID-like pattern)
      if (!href.match(/\/schedule\/.*\/[a-f0-9-]{36}/)) return;

      // Check if this match involves our team
      if (!href.toLowerCase().includes(cleanName.replace(/ /g, "-"))) return;

      // Extract match ID to avoid double-counting
      const matchId = href.split("/").pop();
      if (processedMatches.has(matchId)) return;
      processedMatches.add(matchId);

      // Check if this is a postseason match
      // Look at surrounding text for date/section context
      const parentText = $(el).closest("div, section, article").text();
      const parentLower = parentText.toLowerCase();

      const isPostseason = postseasonKeywords.some((kw) =>
        parentLower.includes(kw),
      );
      if (!isPostseason) return;

      // Determine if our team won this match
      // The match URL format is: .../schedule/{away-team}-vs-{home-team}/{matchId}
      // The set scores follow in the page content

      // Parse the teams from the URL
      const pathParts = href.split("/");
      const matchPart = pathParts[pathParts.length - 2] || "";
      const vsMatch = matchPart.match(/(.+?)-volleyball-vs-(.+?)-volleyball/);
      if (!vsMatch) return;

      // Look for set score totals near this match in the DOM
      // The pattern shows total sets won as single digits (0-3 or 0-5)
      // near the match element
      const nearbyText = $(el).parent().parent().text();
      const setScores = nearbyText.match(/\b([0-3])\b/g);

      if (setScores && setScores.length >= 2) {
        const lastTwo = setScores.slice(-2).map(Number);
        const [score1, score2] = lastTwo;

        // Determine which score belongs to which team
        // This requires knowing the team order in the match display
        const team1Slug = vsMatch[1];
        const isTeam1 = team1Slug.includes(cleanName.replace(/ /g, "-"));

        const ourScore = isTeam1 ? score1 : score2;
        const theirScore = isTeam1 ? score2 : score1;

        if (ourScore > theirScore) {
          postseasonWins++;
        }
      }
    });

    return postseasonWins;
  } catch (error) {
    console.error(`Error fetching postseason data: ${error.message}`);
    return 0;
  }
}

// ---------- MAIN EXPORT ----------

export async function calculateLOVB(teamName) {
  const seasonYear = getCurrentSeasonYear();
  const standingsUrl = `https://www.lovb.com/${seasonYear}/standings`;

  // Clean team name: "LOVB Austin" → "austin", "LOVB Salt Lake" → "salt lake"
  const cleanTeamName = teamName.replace(/^LOVB\s+/i, "").toLowerCase();

  console.log(
    `🏐 LOVB: Fetching standings for "${teamName}" (${cleanTeamName}) from ${standingsUrl}`,
  );

  try {
    const html = await fetchPageHTML(standingsUrl);

    // --- Try each parsing strategy in order of reliability ---

    let result = null;
    let strategyUsed = "";

    // Strategy 1: __NEXT_DATA__ JSON
    result = parseFromNextData(html, cleanTeamName);
    if (result) {
      strategyUsed = "__NEXT_DATA__ JSON";
    }

    // Strategy 2: HTML Table
    if (!result) {
      result = parseFromHTMLTable(html, cleanTeamName);
      if (result) {
        strategyUsed = "HTML Table";
      }
    }

    // Strategy 3: Rendered Text Positional Parsing
    if (!result) {
      result = parseFromRenderedText(html, cleanTeamName);
      if (result) {
        strategyUsed = "Rendered Text Parsing";
      }
    }

    // --- Evaluate results ---
    if (!result || (result.wins === 0 && result.losses === 0)) {
      console.warn(
        `⚠️ LOVB: Could not determine W-L record for ${teamName} from ${standingsUrl}`,
      );
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    const { wins, losses } = result;
    const totalGames = wins + losses;

    // Sanity check: LOVB plays 20 regular season matches
    if (totalGames > 25 || wins < 0 || losses < 0) {
      console.warn(
        `⚠️ LOVB: Suspicious W-L record for ${teamName}: ${wins}-${losses}. Skipping.`,
      );
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    const winPct = totalGames > 0 ? wins / totalGames : 0;
    const regularSeasonScore = Math.round(winPct * 400);

    console.log(
      `✅ LOVB: ${teamName} → ${wins}W-${losses}L (${(winPct * 100).toFixed(1)}%) = ${regularSeasonScore} pts [via ${strategyUsed}]`,
    );

    // --- Postseason ---
    let postseasonScore = 0;
    try {
      const postseasonWins = await getPostseasonWins(teamName, seasonYear);
      postseasonScore = postseasonWins * 100;
      if (postseasonWins > 0) {
        console.log(
          `🏆 LOVB: ${teamName} has ${postseasonWins} postseason win(s) = ${postseasonScore} pts`,
        );
      }
    } catch (err) {
      console.warn(`⚠️ LOVB: Error fetching postseason data: ${err.message}`);
    }

    return { regularSeasonScore, postseasonScore };
  } catch (error) {
    console.error(`🔥 LOVB Script Error (${teamName}):`, error.message);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
