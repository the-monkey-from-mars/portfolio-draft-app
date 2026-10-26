/**
 * espn.js — data fetching for every sport that ESPN covers.
 *
 * Each function returns RAW INPUTS for that sport's scoring schema
 * (lib/scoringSchemas.js). The schema does all of the math, so the cron and
 * the admin editor always agree.
 *
 * Every function THROWS when data can't be fetched or the team/driver isn't
 * found. The cron catches that, logs it, and leaves the pick's existing score
 * untouched — a broken feed never silently zeroes a team.
 */

// One fetch per URL per run (190 picks share ~15 standings feeds).
const cache = new Map();
export function fetchJson(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      // No custom headers: ESPN's firewall returns 403 to user agents that
      // identify as bots. Node's default fetch headers are accepted.
      fetch(url).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
        return res.json();
      }),
    );
  }
  return cache.get(url);
}

export function withSeason(url, season) {
  if (!season) return url;
  return `${url}${url.includes("?") ? "&" : "?"}season=${season}`;
}

// ─── Standings helpers ────────────────────────────────────────

/** Every standings entry in the response, however deeply it is nested. */
export function allEntries(node) {
  const out = [...(node?.standings?.entries || [])];
  for (const child of node?.children || []) out.push(...allEntries(child));
  return out;
}

/** The season ESPN says it returned (for sanity checks in the cron log). */
export function standingsSeason(node) {
  if (node?.standings?.season) return node.standings.season;
  for (const child of node?.children || []) {
    const s = standingsSeason(child);
    if (s) return s;
  }
  return node?.season?.year || null;
}

const stat = (entry, ...names) =>
  entry.stats?.find((s) => names.includes(s.name) || names.includes(s.type));
const statValue = (entry, ...names) => {
  const s = stat(entry, ...names);
  return s && typeof s.value === "number" ? s.value : undefined;
};

/** Parse "12-4" or "10-5-2" into numbers. */
function parseRecord(summary) {
  const m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec((summary || "").trim());
  if (!m) return null;
  return { wins: +m[1], losses: +m[2], ties: m[3] ? +m[3] : 0 };
}

async function findEntry(url, season, teamId) {
  const data = await fetchJson(withSeason(url, season));
  const entry = allEntries(data).find((e) => String(e.team?.id) === String(teamId));
  if (!entry) throw new Error(`team ${teamId} not in standings (${url})`);
  return { entry, season: standingsSeason(data) };
}

// ─── Win % sports (NBA, WNBA, NFL, MLB, CBB, CFB) ─────────────

export async function winPctInputs(url, season, teamId) {
  const { entry, season: returned } = await findEntry(url, season, teamId);
  // Prefer the overall record summary: college football exposes no
  // `winPercent`/`losses` stats, only `overall` = "5-1".
  const overall = stat(entry, "overall", "total");
  const rec = parseRecord(overall?.summary || overall?.displayValue);
  const wins = statValue(entry, "wins");
  const losses = statValue(entry, "losses");
  const ties = statValue(entry, "ties") || 0;
  const inputs = rec || (wins !== undefined && losses !== undefined ? { wins, losses, ties } : null);
  if (!inputs) throw new Error(`no win/loss record for team ${teamId}`);
  return { inputs, returnedSeason: returned };
}

// ─── Table-points sports (NHL, MLS, NWSL, Premier League) ─────

export async function tablePointsInputs(url, season, teamId, kind) {
  const { entry, season: returned } = await findEntry(url, season, teamId);
  const points = statValue(entry, "points");
  const wins = statValue(entry, "wins");
  if (points === undefined || wins === undefined)
    throw new Error(`no table points for team ${teamId}`);
  const inputs =
    kind === "hockey"
      ? {
          wins,
          losses: statValue(entry, "losses") || 0,
          otLosses: statValue(entry, "OTLosses", "otLosses", "overtimeLosses") || 0,
          tablePoints: points,
        }
      : {
          wins,
          draws: statValue(entry, "ties", "draws") || 0,
          losses: statValue(entry, "losses") || 0,
          goalDifference: statValue(entry, "pointDifferential", "goalDifference") ?? "",
          tablePoints: points,
        };
  return { inputs, returnedSeason: returned };
}

// ─── Per-team schedule (NCAAW Volleyball) ─────────────────────
// ESPN's volleyball standings ignore `group=` and only return one
// conference, so we count wins/losses from each team's schedule instead.
// Postseason (NCAA tournament) matches are excluded.

export async function scheduleRecordInputs(sportPath, season, teamId) {
  const url = withSeason(
    `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamId}/schedule`,
    season,
  );
  const data = await fetchJson(url);
  let wins = 0;
  let losses = 0;
  for (const ev of data.events || []) {
    if (ev.seasonType?.type === 3) continue; // postseason
    const comp = ev.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;
    const us = comp.competitors?.find((c) => String(c.team?.id ?? c.id) === String(teamId));
    if (!us) continue;
    if (us.winner === true) wins++;
    else if (us.winner === false) losses++;
  }
  if (wins + losses === 0 && !(data.events || []).length)
    throw new Error(`no schedule for team ${teamId}`);
  return { inputs: { wins, losses, ties: 0 }, returnedSeason: season };
}

// ─── Summer International Soccer (group stage) ────────────────

export async function summerIntlInputs(slugs, season, teamName) {
  const list = Array.isArray(slugs) ? slugs : [slugs];
  const want = normalizeName(teamName);
  for (const slug of list) {
    const url = withSeason(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`, season);
    let data;
    try {
      data = await fetchJson(url);
    } catch {
      continue;
    }
    for (const group of [data, ...(data.children || [])]) {
      const entries = group.standings?.entries || [];
      const entry = entries.find((e) => namesMatch(e.team?.displayName || e.team?.name || "", want));
      if (!entry) continue;
      const rank = statValue(entry, "rank", "groupRank");
      return {
        inputs: {
          wins: statValue(entry, "wins") || 0,
          draws: statValue(entry, "ties", "draws") || 0,
          losses: statValue(entry, "losses") || 0,
          isGroupWinner: rank === 1,
        },
        returnedSeason: standingsSeason(data),
      };
    }
  }
  throw new Error(`"${teamName}" not found in summer tournament standings`);
}

// ─── Name matching (F1 drivers, national teams) ───────────────

export function normalizeName(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Andrea Kimi Antonelli" matches "Kimi Antonelli"; requires the last names to agree. */
export function namesMatch(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const xt = x.split(" ");
  const yt = y.split(" ");
  if (xt[xt.length - 1] !== yt[yt.length - 1]) return false;
  const [short, long] = xt.length <= yt.length ? [xt, yt] : [yt, xt];
  return short.every((t) => long.includes(t));
}

/** Find a name in a list: full/subset match first, then a unique last-name match. */
export function findByName(list, name, getName) {
  const exact = list.filter((item) => namesMatch(getName(item), name));
  if (exact.length === 1) return exact[0];
  const last = normalizeName(name).split(" ").pop();
  const byLast = list.filter((item) => normalizeName(getName(item)).split(" ").pop() === last);
  return byLast.length === 1 ? byLast[0] : null;
}
