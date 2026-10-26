/**
 * scoringSchemas.js — the single source of truth for scoring.
 *
 * Every sport is worth exactly 1000 points per season:
 *   - Regular season ("non-special"):            max 400
 *   - Postseason / special events ("special"):   max 600
 *
 * Both the nightly cron (scripts/masterCron.js) and the admin editor
 * (components/AdminScoreOverride.js) call these same functions, so the
 * numbers on the leaderboard, the breakdown modal and the admin preview
 * can't drift apart. `npm run validate:scoring` checks every sport still
 * adds up to 400 + 600.
 *
 * Each schema defines:
 *   regularSeason.fields              inputs the admin editor shows
 *   regularSeason.compute(inputs)     → { score, derived }
 *   regularSeason.buildBreakdown(...) → breakdown JSON (regular season)
 *   regularSeason.maxInputs           inputs for a perfect season (validation)
 *   postseason.milestones             checkbox milestones or tiered events
 *   postseason.computeFromMilestones  → points (capped at 600)
 *   postseason.buildBreakdown(...)    → breakdown JSON (postseason)
 *
 * Milestone formats:
 *   Checkbox: { label, pts }                       — achieved: true/false
 *   Event:    { label, type: "event", cumulative, tiers: [{label, pts}] }
 *             tiers[0] is always the "nothing" option (0 pts).
 *             cumulative: true  → reaching tier N earns tiers 1..N summed
 *             cumulative: false → the selected tier's pts is the total
 *   exclusiveGroup (optional): milestones in the same group can't both be
 *             earned in one season (e.g. World Cup final vs 3rd-place match).
 *             Only used by the validator to find the best possible path.
 */

export const REGULAR_SEASON_MAX = 400;
export const POSTSEASON_MAX = 600;

const clampReg = (n) =>
  Math.max(0, Math.min(Math.round(n), REGULAR_SEASON_MAX));
const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));

// ═══════════════════════════════════════════════════════════════
// SHARED POSTSEASON HELPERS
// ═══════════════════════════════════════════════════════════════

/** Points earned by one event milestone at its selected tier. */
export function eventPoints(m) {
  const sel = m.selectedTier || 0;
  if (!m.tiers || sel <= 0) return 0;
  if (m.cumulative) {
    let pts = 0;
    for (let i = 1; i <= sel; i++) pts += m.tiers[i]?.pts || 0;
    return pts;
  }
  return m.tiers[sel]?.pts || 0;
}

const round1 = (n) => Math.round(n * 10) / 10;

function sumMilestones(milestones) {
  let total = 0;
  const groups = {}; // exclusiveGroup → best earned value (can't earn both)
  for (const m of milestones) {
    const pts = m.type === "event" ? eventPoints(m) : m.achieved ? m.pts || 0 : 0;
    if (m.exclusiveGroup) groups[m.exclusiveGroup] = Math.max(groups[m.exclusiveGroup] || 0, pts);
    else total += pts;
  }
  for (const v of Object.values(groups)) total += v;
  return Math.min(round1(total), POSTSEASON_MAX);
}

function milestoneBreakdown(milestones) {
  return milestones.map((m) => {
    if (m.type === "event") {
      const sel = m.selectedTier || 0;
      return {
        label: m.label,
        pts: round1(eventPoints(m)),
        achieved: sel > 0,
        detail: sel > 0 ? m.tiers[sel]?.label : m.tiers[0]?.label,
      };
    }
    return { label: m.label, pts: m.pts, achieved: !!m.achieved };
  });
}

/**
 * Rounds are cumulative: earning a round means earning every round before it
 * (an MLB team that reached the LCS also made the playoffs and the Division
 * Series, so it gets 60 + 90 + 120). This fills in any earlier rounds that
 * weren't ticked, so a skipped box can never under-count a pick.
 *
 *   sequential: false   — the section has no ladder (MMA bonuses; per-event
 *                         sports like tennis/golf/F1, where each event's tiers
 *                         are already cumulative inside eventPoints)
 *   ladder: false       — a milestone outside the ladder (non-CFP bowl win)
 *   requires: [labels]  — explicit prerequisites (World Cup 3rd-place match
 *                         requires R32, R16 and QF wins, but not the semifinal)
 * An event that is a prerequisite (NBA Playoff Entry, March Madness entry) is
 * set to its top tier.
 */
export function withPrerequisites(milestones, sequential = true) {
  const out = milestones.map((m) => ({ ...m }));
  const earned = (m) => (m.type === "event" ? (m.selectedTier || 0) > 0 : !!m.achieved);
  const fill = (m) => {
    if (m.type === "event") {
      if (!((m.selectedTier || 0) > 0)) m.selectedTier = m.tiers.length - 1;
    } else m.achieved = true;
  };
  out.forEach((m, i) => {
    if (!earned(m)) return;
    if (m.requires) out.filter((x) => m.requires.includes(x.label)).forEach(fill);
    else if (sequential && m.ladder !== false)
      out.slice(0, i).filter((x) => x.ladder !== false).forEach(fill);
  });
  return out;
}

function postseasonSection(label, formula, milestones, { sequential = true } = {}) {
  const normalize = (ms) => withPrerequisites(ms, sequential);
  return {
    label,
    milestones,
    sequential,
    normalize,
    computeFromMilestones: (ms) => sumMilestones(normalize(ms)),
    buildBreakdown(ms, computed) {
      return {
        label,
        formula,
        milestones: milestoneBreakdown(normalize(ms)),
        computed,
        max: POSTSEASON_MAX,
      };
    },
  };
}

/**
 * Rebuild editable milestones from a saved breakdown.
 * Used by both the admin editor (to pre-fill the form) and the cron
 * (to carry admin-entered postseason results forward every night).
 * Saved milestones are matched by label; event tiers by their detail label.
 */
export function hydrateMilestones(schema, savedPostseason) {
  const saved = savedPostseason?.milestones || [];
  return schema.postseason.milestones.map((m) => {
    const s = saved.find((sm) => sm.label === m.label);
    if (m.type === "event") {
      let selectedTier = 0;
      if (s?.detail) {
        const idx = m.tiers.findIndex((t) => t.label === s.detail);
        if (idx > 0) selectedTier = idx;
      }
      return { ...m, selectedTier };
    }
    return { ...m, achieved: !!s?.achieved };
  });
}

/**
 * Best possible postseason total (for validation): every checkbox and the
 * top tier of every event, taking only the best milestone in each
 * exclusiveGroup.
 */
export function maxPostseasonPath(schema) {
  const groups = {};
  let total = 0;
  for (const m of schema.postseason.milestones) {
    const best =
      m.type === "event"
        ? eventPoints({ ...m, selectedTier: m.tiers.length - 1 })
        : m.pts;
    if (m.type === "event" && !m.cumulative) {
      // non-cumulative: the most valuable tier, wherever it sits
      const top = Math.max(...m.tiers.map((t) => t.pts));
      if (m.exclusiveGroup) groups[m.exclusiveGroup] = Math.max(groups[m.exclusiveGroup] || 0, top);
      else total += top;
      continue;
    }
    if (m.exclusiveGroup)
      groups[m.exclusiveGroup] = Math.max(groups[m.exclusiveGroup] || 0, best);
    else total += best;
  }
  return round1(total + Object.values(groups).reduce((a, b) => a + b, 0));
}

// ═══════════════════════════════════════════════════════════════
// REGULAR SEASON: WIN % (NBA, WNBA, NFL, MLB, CBB, CFB, NCAAW Volleyball)
// Ties count as half a win (matches ESPN's NFL win %).
// ═══════════════════════════════════════════════════════════════

const winPctRegular = {
  fields: [
    { key: "wins", label: "Wins", type: "number", min: 0 },
    { key: "losses", label: "Losses", type: "number", min: 0 },
    { key: "ties", label: "Ties", type: "number", min: 0, required: false },
  ],
  maxInputs: { wins: 17, losses: 0, ties: 0 },
  compute(inputs) {
    const wins = num(inputs.wins);
    const losses = num(inputs.losses);
    const ties = num(inputs.ties);
    const gamesPlayed = wins + losses + ties;
    const winPct = gamesPlayed > 0 ? (wins + 0.5 * ties) / gamesPlayed : 0;
    return {
      score: clampReg(winPct * REGULAR_SEASON_MAX),
      derived: { gamesPlayed, winPct },
    };
  },
  buildBreakdown(inputs, computed, derived) {
    return {
      label: "Win Percentage",
      formula: "winPct × 400 (ties count as half a win)",
      inputs: {
        wins: num(inputs.wins),
        losses: num(inputs.losses),
        ...(num(inputs.ties) ? { ties: num(inputs.ties) } : {}),
        gamesPlayed: derived.gamesPlayed,
        winPct: derived.winPct,
      },
      computed,
      max: REGULAR_SEASON_MAX,
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// REGULAR SEASON: TABLE POINTS (NHL, MLS, NWSL, Premier League)
// Table points / max possible table points × 400.
// If the data source supplies tablePoints directly (it includes any
// league-imposed deductions), that value wins over the W/D/OTL math.
// ═══════════════════════════════════════════════════════════════

function tablePointsRegular({ label, maxTablePoints, kind }) {
  const isHockey = kind === "hockey";
  const fields = isHockey
    ? [
        { key: "wins", label: "Wins", type: "number", min: 0 },
        { key: "losses", label: "Regulation Losses", type: "number", min: 0 },
        { key: "otLosses", label: "OT/SO Losses", type: "number", min: 0 },
      ]
    : [
        { key: "wins", label: "Wins", type: "number", min: 0 },
        { key: "draws", label: "Draws", type: "number", min: 0 },
        { key: "losses", label: "Losses", type: "number", min: 0 },
        { key: "goalDifference", label: "Goal Difference", type: "number", required: false },
      ];
  const gamesInSeason = isHockey ? maxTablePoints / 2 : maxTablePoints / 3;
  return {
    fields,
    maxInputs: { wins: gamesInSeason },
    compute(inputs) {
      const wins = num(inputs.wins);
      const losses = num(inputs.losses);
      const draws = num(inputs.draws);
      const otLosses = num(inputs.otLosses);
      const formulaPoints = isHockey ? wins * 2 + otLosses : wins * 3 + draws;
      const tablePoints =
        inputs.tablePoints !== undefined && inputs.tablePoints !== ""
          ? num(inputs.tablePoints)
          : formulaPoints;
      const gamesPlayed = isHockey
        ? wins + losses + otLosses
        : wins + draws + losses;
      return {
        score: clampReg((tablePoints / maxTablePoints) * REGULAR_SEASON_MAX),
        derived: { tablePoints, gamesPlayed, maxTablePoints },
      };
    },
    buildBreakdown(inputs, computed, derived) {
      return {
        label,
        formula: `(tablePoints / ${maxTablePoints}) × 400`,
        inputs: {
          wins: num(inputs.wins),
          ...(isHockey
            ? { losses: num(inputs.losses), otLosses: num(inputs.otLosses) }
            : { draws: num(inputs.draws), losses: num(inputs.losses) }),
          gamesPlayed: derived.gamesPlayed,
          ...(!isHockey && inputs.goalDifference !== undefined && inputs.goalDifference !== ""
            ? { goalDifference: num(inputs.goalDifference) }
            : {}),
          tablePoints: derived.tablePoints,
          maxTablePoints,
        },
        computed,
        max: REGULAR_SEASON_MAX,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// REGULAR SEASON: RELATIVE TO LEADER (Tennis, Golf, F1)
// (your points / #1's points) × 400
// For F1, both sides exclude the four Crown Jewel Grand Prix (those are
// the postseason); sprint points always count toward the regular season.
// ═══════════════════════════════════════════════════════════════

function relativeRegular({ label, formula, pointsLabel, leaderLabel }) {
  return {
    fields: [
      { key: "athletePoints", label: pointsLabel, type: "number", min: 0, step: "any" },
      { key: "leaderPoints", label: leaderLabel, type: "number", min: 0, step: "any" },
      { key: "leaderName", label: "Leader Name", type: "text" },
      { key: "athleteRank", label: "Rank", type: "number", min: 1, required: false },
    ],
    maxInputs: { athletePoints: 100, leaderPoints: 100 },
    compute(inputs) {
      const leader = num(inputs.leaderPoints);
      if (leader <= 0) return { score: 0, derived: {} };
      return {
        score: clampReg((num(inputs.athletePoints) / leader) * REGULAR_SEASON_MAX),
        derived: {},
      };
    },
    buildBreakdown(inputs, computed) {
      // Pass through any extra context the cron supplies (e.g. F1 totals)
      const { athletePoints, leaderPoints, leaderName, athleteRank, ...extra } = inputs;
      return {
        label,
        formula,
        inputs: {
          athletePoints: num(athletePoints),
          leaderPoints: num(leaderPoints),
          leaderName: leaderName || "Unknown",
          athleteRank: athleteRank || null,
          ...extra,
        },
        computed,
        max: REGULAR_SEASON_MAX,
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// POSTSEASON BUILDING BLOCKS
// ═══════════════════════════════════════════════════════════════

const checkboxes = (pairs) => pairs.map(([label, pts]) => ({ label, pts }));

/** A tiered event; `tiers` are [label, pts] after the 0-pt "none" option. */
const event = (label, noneLabel, tiers, opts = {}) => ({
  label,
  type: "event",
  cumulative: opts.cumulative ?? true,
  ...(opts.exclusiveGroup ? { exclusiveGroup: opts.exclusiveGroup } : {}),
  tiers: [{ label: noneLabel, pts: 0 }, ...tiers.map(([l, p]) => ({ label: l, pts: p }))],
});

// Standard pro playoff ladder: 60 / 90 / 120 / 150 / 180 = 600.
// Byes earn the rounds they skip (check every box up to where they reached).
function proLadder(round2, round3, finals, champion, { playIn = false } = {}) {
  const entry = playIn
    ? [
        // NBA: Play-In entry +30; surviving to the 16-team field +30 more.
        event("Playoff Entry", "Missed playoffs", [
          ["Play-In only (eliminated)", 30],
          ["Made playoffs (direct or via Play-In)", 60],
        ], { cumulative: false }),
      ]
    : checkboxes([["Make Playoffs", 60]]);
  return [
    ...entry,
    ...checkboxes([
      [round2, 90],
      [round3, 120],
      [finals, 150],
      [champion, 180],
    ]),
  ];
}

// March Madness: entry 20 (First Four teams: 10, +10 if they reach the 64)
// then 40 / 60 / 80 / 110 / 130 / 160 = 600.
const marchMadness = [
  event("Tournament Entry", "Missed tournament", [
    ["First Four only (eliminated)", 10],
    ["Round of 64 (direct or via First Four)", 20],
  ], { cumulative: false }),
  ...checkboxes([
    ["Round of 32", 40],
    ["Sweet 16", 60],
    ["Elite 8", 80],
    ["Final Four", 110],
    ["Title Game", 130],
    ["National Champion", 160],
  ]),
];

// Premier League: European competition (one of UCL / UEL / UECL; Europa =
// 66% and Conference = 33% of UCL), FA Cup, Carabao Cup. 295 + 190 + 115 = 600.
const UCL_LADDER = [
  ["Knockouts", 20],
  ["Quarterfinals", 35],
  ["Semifinals", 55],
  ["Final", 80],
  ["Win", 105],
];
function europeTiers() {
  const tiers = [];
  for (const [comp, factor] of [["UCL", 1], ["Europa", 0.66], ["Conference", 0.33]]) {
    let running = 0;
    for (const [stage, pts] of UCL_LADDER) {
      running += pts * factor;
      tiers.push([`${comp}: ${stage}`, round1(running)]);
    }
  }
  return tiers;
}

const TENNIS_TIERS = [
  ["Round of 32", 3.6],
  ["Round of 16", 7.1],
  ["Quarterfinal", 14.3],
  ["Semifinal", 28.6],
  ["Final", 39.2],
  ["Winner", 57.2],
]; // cumulative 150 per Slam × 4 = 600

const PGA_TIERS = [["Made Cut", 15], ["Top 10", 30], ["Top 5", 45], ["Winner", 60]]; // 150 × 4
const LPGA_TIERS = [["Made Cut", 12], ["Top 10", 24], ["Top 5", 36], ["Winner", 48]]; // 120 × 5

// F1 Crown Jewel tiers: 150 per race × 4 = 600.
export const F1_CROWN_JEWEL_TIERS = [
  ["Points Finish (P6–P10)", 15],
  ["Top 5 (P4–P5)", 30],
  ["Podium (P2–P3)", 45],
  ["Race Win", 60],
];
export const F1_CROWN_JEWEL_RACES = ["Monaco GP", "British GP", "Belgian GP", "Italian GP"];

/** Finishing position → Crown Jewel tier index (0 = outside the points). */
export function f1TierForPosition(pos) {
  if (!pos || pos > 10) return 0;
  if (pos === 1) return 4;
  if (pos <= 3) return 3;
  if (pos <= 5) return 2;
  return 1;
}

const tennisSlams = ["Australian Open", "French Open", "Wimbledon", "US Open"].map(
  (s) => event(s, "Did not reach Rd of 32", TENNIS_TIERS),
);

// ═══════════════════════════════════════════════════════════════
// SCHEMA FACTORIES
// ═══════════════════════════════════════════════════════════════

function schema(sportType, regularSeason, postLabel, postFormula, milestones, opts) {
  return {
    sportType,
    regularSeason,
    postseason: postseasonSection(postLabel, postFormula, milestones, opts),
  };
}
const INDEPENDENT = { sequential: false }; // no round ladder between milestones

const LADDER_FORMULA = "Cumulative round bonuses (60 / 90 / 120 / 150 / 180)";

// ═══════════════════════════════════════════════════════════════
// MMA (manual entry — no automated source)
// ═══════════════════════════════════════════════════════════════

const mmaSchema = schema(
  "mma_fight_log",
  {
    fields: [{ key: "totalWins", label: "Total Wins This Year", type: "number", min: 0 }],
    maxInputs: { totalWins: 2 },
    compute(inputs) {
      const totalWins = num(inputs.totalWins);
      return { score: clampReg(totalWins * 200), derived: { totalWins } };
    },
    buildBreakdown(inputs, computed, derived) {
      return {
        label: "Fight Wins (200 per win, max 400)",
        formula: "200 × wins (capped at 400)",
        inputs: { totalWins: derived.totalWins },
        computed,
        max: REGULAR_SEASON_MAX,
      };
    },
  },
  "High-Leverage Events",
  "Main Event (+100), Top-5 Opponent (+150), Title Fight (+350) — capped at 600",
  checkboxes([
    ["Main Event Bout", 100],
    ["Win vs. Top-5 Opponent", 150],
    ["Win Title Fight", 350],
  ]),
  INDEPENDENT,
);

// ═══════════════════════════════════════════════════════════════
// SUMMER INTERNATIONAL SOCCER (group stage + knockouts)
// 48-team format (2026, 2030 World Cups). See lib/sportConfig.js for the
// tournament rotation; 32-team years use summerIntlSchema32 below.
// ═══════════════════════════════════════════════════════════════

const summerIntlRegular = {
  fields: [
    { key: "wins", label: "Group Wins", type: "number", min: 0 },
    { key: "draws", label: "Group Draws", type: "number", min: 0 },
    { key: "losses", label: "Group Losses", type: "number", min: 0 },
    { key: "isGroupWinner", label: "Won the Group?", type: "checkbox" },
  ],
  maxInputs: { wins: 3, draws: 0, losses: 0, isGroupWinner: true },
  compute(inputs) {
    const bonus = inputs.isGroupWinner ? 100 : 0;
    return {
      score: clampReg(num(inputs.wins) * 100 + num(inputs.draws) * 35 + bonus),
      derived: { groupWinnerBonus: bonus, groupRank: inputs.isGroupWinner ? 1 : null },
    };
  },
  buildBreakdown(inputs, computed, derived) {
    return {
      label: "Group Stage",
      formula: "(wins × 100) + (draws × 35) + (group winner bonus: 100)",
      inputs: {
        wins: num(inputs.wins),
        draws: num(inputs.draws),
        losses: num(inputs.losses),
        groupRank: derived.groupRank,
        isGroupWinner: !!inputs.isGroupWinner,
        groupWinnerBonus: derived.groupWinnerBonus,
      },
      computed,
      max: REGULAR_SEASON_MAX,
    };
  },
};

const summerIntlSchema = schema(
  "intl_soccer_tournament",
  summerIntlRegular,
  "Knockout Stage",
  "R32 (+50), R16 (+75), QF (+100), SF (+125), Final (+250); 3rd-place win (+75)",
  [
    ...checkboxes([
      ["Round of 32 Win", 50],
      ["Round of 16 Win", 75],
      ["Quarterfinal Win", 100],
      ["Semifinal Win", 125],
    ]),
    { label: "Win the Final", pts: 250, exclusiveGroup: "medal" },
    {
      label: "3rd Place Match Win",
      pts: 75,
      exclusiveGroup: "medal",
      requires: ["Round of 32 Win", "Round of 16 Win", "Quarterfinal Win"],
    },
  ],
);

export const summerIntlSchema32 = schema(
  "intl_soccer_tournament",
  summerIntlRegular,
  "Knockout Stage",
  "R16 (+75), QF (+125), SF (+150), Final (+250)",
  checkboxes([
    ["Round of 16 Win", 75],
    ["Quarterfinal Win", 125],
    ["Semifinal Win", 150],
    ["Win the Final", 250],
  ]),
);

// ═══════════════════════════════════════════════════════════════
// MASTER SCHEMA MAP — keyed by sport_id
// ═══════════════════════════════════════════════════════════════

export const SCORING_SCHEMAS = {
  // NBA (1) — Play-In: +30 entry, +30 for reaching the 16-team field
  1: schema("standard_win_pct", winPctRegular, "Playoff Advancement", LADDER_FORMULA,
    proLadder("Advance to Round 2", "Conference Finals", "NBA Finals", "Win Championship", { playIn: true })),

  // WNBA (2) — 90 / 130 / 170 / 210 = 600
  2: schema("standard_win_pct", winPctRegular, "Playoff Advancement",
    "Make Playoffs (+90), Semifinals (+130), Finals (+170), Win (+210)",
    checkboxes([
      ["Make Playoffs", 90],
      ["Semifinals", 130],
      ["WNBA Finals", 170],
      ["Win Championship", 210],
    ])),

  // NFL (3)
  3: schema("standard_win_pct", winPctRegular, "Playoff Advancement", LADDER_FORMULA,
    proLadder("Divisional Round", "Conference Championship", "Super Bowl", "Win Super Bowl")),

  // MLB (4)
  4: schema("standard_win_pct", winPctRegular, "Playoff Advancement", LADDER_FORMULA,
    proLadder("Division Series", "League Championship", "World Series", "Win World Series")),

  // NHL (5) — 84-game season from 2026-27 → 168 max table points
  5: schema("nhl_points",
    tablePointsRegular({ label: "NHL Table Points", maxTablePoints: 168, kind: "hockey" }),
    "Playoff Advancement", LADDER_FORMULA,
    proLadder("Advance to Round 2", "Conference Finals", "Stanley Cup Finals", "Win Stanley Cup")),

  // MLS (6) — 34 games → 102 max table points (2026 season)
  6: schema("soccer_table",
    tablePointsRegular({ label: "MLS Table Points", maxTablePoints: 102, kind: "soccer" }),
    "MLS Cup Playoffs", LADDER_FORMULA,
    proLadder("Advance to Round 2", "Conference Finals", "MLS Cup Final", "Win MLS Cup")),

  // NCAAW Volleyball (7)
  7: schema("standard_win_pct", winPctRegular, "NCAA Tournament",
    "Make Tournament (+60), Sweet 16 (+90), Elite 8 (+120), Final Four (+150), Champion (+180)",
    checkboxes([
      ["Make NCAA Tournament", 60],
      ["Sweet 16", 90],
      ["Elite 8", 120],
      ["Final Four", 150],
      ["Win Championship", 180],
    ])),

  // Premier League (8) — 38 games → 114 max table points
  8: schema("soccer_table",
    tablePointsRegular({ label: "Premier League Table Points", maxTablePoints: 114, kind: "soccer" }),
    "Cups & European Play",
    "UCL ladder 20/35/55/80/105 (Europa ×0.66, Conference ×0.33); FA Cup 20/35/55/80; Carabao 10/20/35/50",
    [
      event("European Competition", "No European run", europeTiers(), { cumulative: false }),
      event("FA Cup", "Out before QF", [["Quarterfinal", 20], ["Semifinal", 35], ["Final", 55], ["Win", 80]]),
      event("Carabao Cup", "Out before QF", [["Quarterfinal", 10], ["Semifinal", 20], ["Final", 35], ["Win", 50]]),
    ], INDEPENDENT),

  // College Football (9) — top-4 seeds with byes earn the first 125.
  // A non-CFP bowl WIN is worth half a CFP first-round win (75 / 2 = 37.5).
  // A team plays a bowl or the CFP, never both (exclusiveGroup).
  9: schema("standard_win_pct", winPctRegular, "CFP & Bowl Postseason",
    "Make CFP (+50), Quarterfinals (+75), Semifinals (+100), Title Game (+150), Win (+225); non-CFP bowl win (+37.5)",
    [
      { label: "Make 12-Team CFP", pts: 50, exclusiveGroup: "cfp_or_bowl" },
      ...checkboxes([
        ["Quarterfinals", 75],
        ["Semifinals", 100],
        ["National Championship Game", 150],
        ["Win National Championship", 225],
      ]),
      { label: "Win Non-CFP Bowl Game", pts: 37.5, exclusiveGroup: "cfp_or_bowl", ladder: false },
    ]),

  // Men's CBB (10) / Women's CBB (11)
  10: schema("standard_win_pct", winPctRegular, "March Madness",
    "Entry (+20; First Four +10/+10), R32 (+40), S16 (+60), E8 (+80), F4 (+110), Title Game (+130), Champion (+160)",
    marchMadness),
  11: schema("standard_win_pct", winPctRegular, "March Madness",
    "Entry (+20; First Four +10/+10), R32 (+40), S16 (+60), E8 (+80), F4 (+110), Title Game (+130), Champion (+160)",
    marchMadness),

  // ATP (12) / WTA (13)
  12: schema("tennis_relative",
    relativeRegular({
      label: "ATP Race Points (Relative to Leader)",
      formula: "(athletePts / leaderPts) × 400",
      pointsLabel: "Athlete Race Points",
      leaderLabel: "Race Leader Points",
    }),
    "Grand Slam Performance",
    "Rd32 (+3.6), Rd16 (+7.1), QF (+14.3), SF (+28.6), Final (+39.2), Win (+57.2) — cumulative per Slam",
    tennisSlams, INDEPENDENT),
  13: schema("tennis_relative",
    relativeRegular({
      label: "WTA Race Points (Relative to Leader)",
      formula: "(athletePts / leaderPts) × 400",
      pointsLabel: "Athlete Race Points",
      leaderLabel: "Race Leader Points",
    }),
    "Grand Slam Performance",
    "Rd32 (+3.6), Rd16 (+7.1), QF (+14.3), SF (+28.6), Final (+39.2), Win (+57.2) — cumulative per Slam",
    tennisSlams, INDEPENDENT),

  // PGA (14) — 4 majors × 150
  14: schema("golf_relative",
    relativeRegular({
      label: "FedEx Cup Points (Relative to Leader)",
      formula: "(athletePts / leaderPts) × 400",
      pointsLabel: "Golfer FedEx Cup Points",
      leaderLabel: "FedEx Cup Leader Points",
    }),
    "Major Championship Performance",
    "Made Cut (+15), Top 10 (+30), Top 5 (+45), Win (+60) — cumulative per Major",
    ["The Masters", "PGA Championship", "U.S. Open", "The Open Championship"].map(
      (s) => event(s, "Missed cut / DNP", PGA_TIERS),
    ), INDEPENDENT),

  // LPGA (15) — 5 majors × 120
  15: schema("golf_relative",
    relativeRegular({
      label: "Race to CME Globe Points (Relative to Leader)",
      formula: "(athletePts / leaderPts) × 400",
      pointsLabel: "Golfer CME Points",
      leaderLabel: "CME Leader Points",
    }),
    "Major Championship Performance",
    "Made Cut (+12), Top 10 (+24), Top 5 (+36), Win (+48) — cumulative per Major",
    [
      "Chevron Championship",
      "KPMG Women's PGA",
      "U.S. Women's Open",
      "The Evian Championship",
      "AIG Women's Open",
    ].map((s) => event(s, "Missed cut / DNP", LPGA_TIERS)), INDEPENDENT),

  // Formula 1 (16)
  16: schema("f1_relative",
    relativeRegular({
      label: "WDC Points excl. Crown Jewel GPs (Relative to Leader)",
      formula: "(driver non-CJ pts / leader non-CJ pts) × 400 — sprints count",
      pointsLabel: "Driver non-Crown-Jewel WDC Points",
      leaderLabel: "Leader non-Crown-Jewel WDC Points",
    }),
    "Crown Jewel Races (Monaco, British, Belgian, Italian GPs)",
    "Points finish (+15), Top 5 (+30), Podium (+45), Win (+60) — cumulative per race",
    F1_CROWN_JEWEL_RACES.map((r) => event(r, "Outside the points / DNF", F1_CROWN_JEWEL_TIERS)), INDEPENDENT),

  // MMA (17)
  17: mmaSchema,

  // NWSL (18) — 30 games → 90 max; 8-team single elimination
  18: schema("soccer_table",
    tablePointsRegular({ label: "NWSL Table Points", maxTablePoints: 90, kind: "soccer" }),
    "NWSL Playoffs (Single Elimination)",
    "Win Quarterfinal (+100), Win Semifinal (+200), Win Championship (+300)",
    checkboxes([
      ["Win Quarterfinal", 100],
      ["Win Semifinal", 200],
      ["Win NWSL Championship", 300],
    ])),

  // Summer Intl Soccer (19)
  19: summerIntlSchema,
};

/** Schema for a pick, accounting for the rotating summer tournament format. */
export function schemaFor(sportId, summerConfig) {
  if (sportId === 19 && summerConfig && summerConfig.knockoutRounds === 4)
    return summerIntlSchema32;
  return SCORING_SCHEMAS[sportId];
}

/**
 * Score one pick end to end.
 *   regularInputs — raw inputs (from a data source or the admin form)
 *   milestones    — hydrated postseason milestones
 * Returns the three score columns plus the full breakdown JSON.
 */
export function scorePick(s, regularInputs, milestones) {
  const reg = s.regularSeason.compute(regularInputs);
  const post = s.postseason.computeFromMilestones(milestones);
  return {
    regularSeasonScore: reg.score,
    postseasonScore: post,
    totalScore: round1(reg.score + post),
    breakdown: {
      sportType: s.sportType,
      regularSeason: s.regularSeason.buildBreakdown(regularInputs, reg.score, reg.derived || {}),
      postseason: s.postseason.buildBreakdown(milestones, post),
    },
  };
}
