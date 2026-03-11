/**
 * calculateSummerIntl
 *
 * This script handles scoring for rotating summer international soccer tournaments.
 * Think of it as a universal adapter — the same plug fits different outlets
 * depending on which tournament is happening that year.
 *
 * ═══════════════════════════════════════════════════════════════
 * 2026 Men's World Cup (48 teams, 5-round knockout):
 * ═══════════════════════════════════════════════════════════════
 *
 * GROUP STAGE / "Regular Season" (Max 400 Points):
 *   Group Win:            100 pts
 *   Group Draw:            35 pts
 *   Group Winner Bonus:   100 pts
 *   Perfect group (3-0-0 + winner): 300 + 100 = 400
 *
 * KNOCKOUT STAGE (Max 600 Points):
 *   Round of 32 Win:       50 pts
 *   Round of 16 Win:       75 pts
 *   Quarterfinal Win:     100 pts
 *   Semifinal Win:        125 pts
 *   Final Win:            250 pts
 *   Champion total:       600 pts
 *
 *   3rd Place Match Win:   75 pts (consolation)
 *
 * ═══════════════════════════════════════════════════════════════
 * For smaller tournaments (32 teams, 4-round knockout):
 * ═══════════════════════════════════════════════════════════════
 *
 * GROUP STAGE (same formula — Max 400):
 *   Group Win:            100 pts
 *   Group Draw:            35 pts
 *   Group Winner Bonus:   100 pts
 *
 * KNOCKOUT STAGE (Max 600 — distributed across 4 rounds):
 *   Round of 16 Win:       75 pts
 *   Quarterfinal Win:     125 pts
 *   Semifinal Win:        150 pts
 *   Final Win:            250 pts
 *   Champion total:       600 pts
 *
 * ═══════════════════════════════════════════════════════════════
 *
 * The scoring is intentionally manual-override-friendly since these are
 * short tournaments (3-7 games total per team) where results can be
 * entered quickly via the Admin Score Override panel after each matchday.
 *
 * For automated scoring, the script fetches ESPN event data when available.
 */

export async function calculateSummerIntl(apiUniqueId, espnSlug) {
  try {
    // If espnSlug is an array (combined tournaments like Euro + Copa), try each
    const slugs = Array.isArray(espnSlug) ? espnSlug : [espnSlug];

    let teamStats = null;

    for (const slug of slugs) {
      const url = `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(
          `Failed to fetch standings for ${slug}: HTTP ${res.status}`,
        );
        continue;
      }

      const data = await res.json();

      // Search through groups/conferences for the team
      if (data.children && data.children.length > 0) {
        for (const group of data.children) {
          const entries = group.standings?.entries || [];
          const found = entries.find((t) => t.team.id === apiUniqueId);
          if (found) {
            teamStats = found;
            break;
          }
        }
      }

      // Flat standings fallback
      if (!teamStats && data.standings?.entries) {
        teamStats = data.standings.entries.find(
          (t) => t.team.id === apiUniqueId,
        );
      }

      if (teamStats) break;
    }

    if (!teamStats) {
      console.warn(
        `Could not find team ID ${apiUniqueId} in summer intl soccer standings.`,
      );
      return { regularSeasonScore: 0, postseasonScore: 0 };
    }

    // Extract group stage stats
    const winsStat = teamStats.stats.find((s) => s.name === "wins");
    const drawsStat = teamStats.stats.find((s) => s.name === "ties");
    const groupPosStat = teamStats.stats.find(
      (s) => s.name === "rank" || s.name === "groupRank",
    );

    const wins = winsStat ? winsStat.value : 0;
    const draws = drawsStat ? drawsStat.value : 0;
    const groupRank = groupPosStat ? groupPosStat.value : 99;

    // Group stage scoring
    let regularSeasonScore = wins * 100 + draws * 35;

    // Group winner bonus (rank === 1 in their group)
    if (groupRank === 1) {
      regularSeasonScore += 100;
    }

    // Cap at 400
    regularSeasonScore = Math.min(regularSeasonScore, 400);

    // Knockout stage: placeholder for manual override / future automation
    const postseasonScore = 0;

    return { regularSeasonScore, postseasonScore };
  } catch (error) {
    console.error("Summer Intl Soccer Script Error:", error);
    return { regularSeasonScore: 0, postseasonScore: 0 };
  }
}
