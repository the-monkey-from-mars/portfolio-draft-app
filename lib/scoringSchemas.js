/**
 * scoringSchemas.js
 *
 * Each sport has a schema that defines:
 *   - regularSeason.fields: what inputs the admin sees (wins, losses, points, etc.)
 *   - regularSeason.compute(inputs): calculates the regular season score from those inputs
 *   - regularSeason.buildBreakdown(inputs, computed): returns the breakdown JSON section
 *   - postseason.milestones: checkable milestones with point values
 *   - postseason.computeFromMilestones(milestones): sums achieved milestone points
 *   - postseason.buildBreakdown(milestones, computed): returns the breakdown JSON section
 *
 * The admin form reads these schemas to dynamically render the right fields.
 * When saved, it runs compute() and buildBreakdown() to generate both the
 * final scores AND the breakdown JSON in one pass.
 */

// ═══════════════════════════════════════════════════════════════
// STANDARD WIN % SPORTS (NBA, NFL, MLB, WNBA, CBB, CFB, WVB)
// ═══════════════════════════════════════════════════════════════

function standardWinPctSchema(postMilestones, postLabel) {
  return {
    sportType: "standard_win_pct",
    regularSeason: {
      fields: [
        { key: "wins", label: "Wins", type: "number", min: 0 },
        { key: "losses", label: "Losses", type: "number", min: 0 },
      ],
      compute(inputs) {
        const total = (inputs.wins || 0) + (inputs.losses || 0);
        const winPct = total > 0 ? inputs.wins / total : 0;
        return {
          score: Math.min(Math.round(winPct * 400), 400),
          derived: { gamesPlayed: total, winPct },
        };
      },
      buildBreakdown(inputs, computed, derived) {
        return {
          label: "Win Percentage",
          formula: "(winPct × 400)",
          inputs: {
            wins: inputs.wins || 0,
            losses: inputs.losses || 0,
            gamesPlayed: derived.gamesPlayed,
            winPct: derived.winPct,
          },
          computed,
          max: 400,
        };
      },
    },
    postseason: {
      label: postLabel || "Playoff Advancement",
      milestones: postMilestones,
      computeFromMilestones(milestones) {
        return milestones
          .filter((m) => m.achieved)
          .reduce((sum, m) => sum + m.pts, 0);
      },
      buildBreakdown(milestones, computed) {
        return {
          label: postLabel || "Playoff Advancement",
          formula: "Cumulative bracket bonuses",
          milestones: milestones.map((m) => ({
            label: m.label,
            pts: m.pts,
            achieved: m.achieved,
          })),
          computed,
          max: 600,
        };
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// NHL (Table Points / 164)
// ═══════════════════════════════════════════════════════════════

const nhlSchema = {
  sportType: "nhl_points",
  regularSeason: {
    fields: [
      { key: "wins", label: "Wins", type: "number", min: 0 },
      { key: "losses", label: "Losses", type: "number", min: 0 },
      { key: "otLosses", label: "OT Losses", type: "number", min: 0 },
    ],
    compute(inputs) {
      const tablePoints = (inputs.wins || 0) * 2 + (inputs.otLosses || 0);
      const gamesPlayed =
        (inputs.wins || 0) + (inputs.losses || 0) + (inputs.otLosses || 0);
      return {
        score: Math.min(Math.round((tablePoints / 164) * 400), 400),
        derived: { tablePoints, gamesPlayed, maxTablePoints: 164 },
      };
    },
    buildBreakdown(inputs, computed, derived) {
      return {
        label: "NHL Table Points",
        formula: "(tablePoints / 164) × 400",
        inputs: {
          wins: inputs.wins || 0,
          losses: inputs.losses || 0,
          otLosses: inputs.otLosses || 0,
          gamesPlayed: derived.gamesPlayed,
          tablePoints: derived.tablePoints,
          maxTablePoints: 164,
        },
        computed,
        max: 400,
      };
    },
  },
  postseason: {
    label: "Playoff Advancement",
    milestones: [
      { label: "Make Playoffs", pts: 60 },
      { label: "Advance to Round 2", pts: 90 },
      { label: "Conference Finals", pts: 120 },
      { label: "Stanley Cup Finals", pts: 150 },
      { label: "Win Stanley Cup", pts: 180 },
    ],
    computeFromMilestones(milestones) {
      return milestones
        .filter((m) => m.achieved)
        .reduce((sum, m) => sum + m.pts, 0);
    },
    buildBreakdown(milestones, computed) {
      return {
        label: "Playoff Advancement",
        formula: "Cumulative bracket bonuses",
        milestones: milestones.map((m) => ({
          label: m.label,
          pts: m.pts,
          achieved: m.achieved,
        })),
        computed,
        max: 600,
      };
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// SOCCER TABLE (MLS, Premier League)
// ═══════════════════════════════════════════════════════════════

function soccerTableSchema(maxTablePoints, postMilestones, postLabel) {
  return {
    sportType: "soccer_table",
    regularSeason: {
      fields: [
        { key: "wins", label: "Wins", type: "number", min: 0 },
        { key: "draws", label: "Draws", type: "number", min: 0 },
        { key: "losses", label: "Losses", type: "number", min: 0 },
        {
          key: "goalDifference",
          label: "Goal Difference",
          type: "number",
        },
      ],
      compute(inputs) {
        const tablePoints = (inputs.wins || 0) * 3 + (inputs.draws || 0);
        const gamesPlayed =
          (inputs.wins || 0) + (inputs.draws || 0) + (inputs.losses || 0);
        return {
          score: Math.min(
            Math.round((tablePoints / maxTablePoints) * 400),
            400,
          ),
          derived: { tablePoints, gamesPlayed, maxTablePoints },
        };
      },
      buildBreakdown(inputs, computed, derived) {
        return {
          label: "Table Points",
          formula: `(tablePoints / ${maxTablePoints}) × 400`,
          inputs: {
            wins: inputs.wins || 0,
            draws: inputs.draws || 0,
            losses: inputs.losses || 0,
            gamesPlayed: derived.gamesPlayed,
            goalDifference: inputs.goalDifference || 0,
            tablePoints: derived.tablePoints,
            maxTablePoints,
          },
          computed,
          max: 400,
        };
      },
    },
    postseason: {
      label: postLabel,
      milestones: postMilestones,
      computeFromMilestones(milestones) {
        return Math.min(
          milestones
            .filter((m) => m.achieved)
            .reduce((sum, m) => sum + m.pts, 0),
          600,
        );
      },
      buildBreakdown(milestones, computed) {
        return {
          label: postLabel,
          formula: "Cumulative bracket bonuses",
          milestones: milestones.map((m) => ({
            label: m.label,
            pts: m.pts,
            achieved: m.achieved,
          })),
          computed,
          max: 600,
        };
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// RELATIVE POINTS (Tennis, Golf, F1)
//
// These sports use EVENTS with TIERS instead of simple checkboxes.
// e.g. "Australian Open" → dropdown: DNP / Rd32 / Rd16 / QF / SF / Final / Win
// Each tier has cumulative points (reaching QF earns Rd32 + Rd16 + QF points).
//
// The milestone format for events:
//   { label: "Australian Open", type: "event", cumulative: true, tiers: [
//       { label: "DNP", pts: 0 },
//       { label: "Rd of 32", pts: 3.6 },
//       { label: "Rd of 16", pts: 7.1 },  // cumulative: 3.6 + 7.1 = 10.7
//       ...
//   ], selectedTier: 0 }
//
// The admin picks a tier from a dropdown, and the points are summed
// across all tiers up to and including the selected one.
// ═══════════════════════════════════════════════════════════════

function relativePointsSchema(
  regLabel,
  leaderLabel,
  pointsLabel,
  postEvents,
  postLabel,
  postFormula,
  sportType,
) {
  return {
    sportType: sportType || "relative_points",
    regularSeason: {
      fields: [
        {
          key: "athletePoints",
          label: pointsLabel || "Athlete Points",
          type: "number",
          min: 0,
          step: "any",
        },
        {
          key: "leaderPoints",
          label: leaderLabel || "Leader Points",
          type: "number",
          min: 0,
          step: "any",
        },
        {
          key: "leaderName",
          label: "Leader Name",
          type: "text",
        },
        {
          key: "athleteRank",
          label: "Rank",
          type: "number",
          min: 1,
          required: false,
        },
      ],
      compute(inputs) {
        const leaderPts = inputs.leaderPoints || 0;
        const athletePts = inputs.athletePoints || 0;
        if (leaderPts === 0) return { score: 0, derived: {} };
        return {
          score: Math.min(Math.round((athletePts / leaderPts) * 400), 400),
          derived: {},
        };
      },
      buildBreakdown(inputs, computed) {
        return {
          label: regLabel,
          formula: "(athletePts / leaderPts) × 400",
          inputs: {
            athletePoints: inputs.athletePoints || 0,
            leaderPoints: inputs.leaderPoints || 0,
            leaderName: inputs.leaderName || "Unknown",
            athleteRank: inputs.athleteRank || null,
          },
          computed,
          max: 400,
        };
      },
    },
    postseason: {
      label: postLabel,
      milestones: postEvents, // array of event objects with tiers
      computeFromMilestones(milestones) {
        let total = 0;
        for (const m of milestones) {
          if (m.type === "event" && m.tiers && m.selectedTier > 0) {
            if (m.cumulative) {
              // Tennis: sum all tiers up to and including the selected one
              for (let i = 1; i <= m.selectedTier; i++) {
                total += m.tiers[i]?.pts || 0;
              }
            } else {
              // Golf/F1: the selected tier IS the total (pick best result)
              total += m.tiers[m.selectedTier]?.pts || 0;
            }
          } else if (m.achieved) {
            total += m.pts || 0;
          }
        }
        return Math.min(total, 600);
      },
      buildBreakdown(milestones, computed) {
        return {
          label: postLabel,
          formula: postFormula || "Cumulative event bonuses",
          milestones: milestones.map((m) => {
            if (m.type === "event" && m.tiers) {
              const selectedIdx = m.selectedTier || 0;
              const selectedLabel =
                selectedIdx > 0
                  ? m.tiers[selectedIdx]?.label
                  : "Did not participate";
              let eventPts = 0;
              if (m.cumulative) {
                for (let i = 1; i <= selectedIdx; i++) {
                  eventPts += m.tiers[i]?.pts || 0;
                }
              } else {
                eventPts = m.tiers[selectedIdx]?.pts || 0;
              }
              return {
                label: m.label,
                pts: eventPts,
                achieved: selectedIdx > 0,
                detail: selectedLabel,
              };
            }
            return {
              label: m.label,
              pts: m.pts,
              achieved: m.achieved || false,
            };
          }),
          computed,
          max: 600,
        };
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// MMA (Fight Log)
// ═══════════════════════════════════════════════════════════════

const mmaSchema = {
  sportType: "mma_fight_log",
  regularSeason: {
    fields: [
      {
        key: "totalWins",
        label: "Total Wins This Year",
        type: "number",
        min: 0,
      },
    ],
    compute(inputs) {
      const score = Math.min((inputs.totalWins || 0) * 200, 400);
      return { score, derived: { totalWins: inputs.totalWins || 0 } };
    },
    buildBreakdown(inputs, computed, derived) {
      return {
        label: "Fight Wins (200 pts per Win, Max 400)",
        formula: "200 × wins (capped at 400)",
        inputs: {
          totalWins: derived.totalWins,
          totalFights: derived.totalWins, // Approximation for manual entry
        },
        computed,
        max: 400,
      };
    },
  },
  postseason: {
    label: "High-Leverage Events",
    milestones: [
      { label: "Main Event Bout", pts: 100 },
      { label: "Win vs. Top-5 Opponent", pts: 150 },
      { label: "Win Title Fight", pts: 350 },
    ],
    computeFromMilestones(milestones) {
      return Math.min(
        milestones.filter((m) => m.achieved).reduce((sum, m) => sum + m.pts, 0),
        600,
      );
    },
    buildBreakdown(milestones, computed) {
      return {
        label: "High-Leverage Events",
        formula: "Main Event (+100), Top-5 Opponent (+150), Title Fight (+350)",
        milestones: milestones.map((m) => ({
          label: m.label,
          pts: m.pts,
          achieved: m.achieved,
        })),
        computed,
        max: 600,
      };
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// SUMMER INTERNATIONAL SOCCER (Tournament)
// ═══════════════════════════════════════════════════════════════

const summerIntlSchema = {
  sportType: "intl_soccer_tournament",
  regularSeason: {
    fields: [
      { key: "wins", label: "Group Wins", type: "number", min: 0 },
      { key: "draws", label: "Group Draws", type: "number", min: 0 },
      { key: "losses", label: "Group Losses", type: "number", min: 0 },
      { key: "isGroupWinner", label: "Won the Group?", type: "checkbox" },
    ],
    compute(inputs) {
      let score = (inputs.wins || 0) * 100 + (inputs.draws || 0) * 35;
      if (inputs.isGroupWinner) score += 100;
      return {
        score: Math.min(score, 400),
        derived: {
          groupWinnerBonus: inputs.isGroupWinner ? 100 : 0,
          groupRank: inputs.isGroupWinner ? 1 : null,
        },
      };
    },
    buildBreakdown(inputs, computed, derived) {
      return {
        label: "Group Stage",
        formula: "(wins × 100) + (draws × 35) + (group winner bonus: 100)",
        inputs: {
          wins: inputs.wins || 0,
          draws: inputs.draws || 0,
          losses: inputs.losses || 0,
          groupRank: derived.groupRank,
          isGroupWinner: !!inputs.isGroupWinner,
          groupWinnerBonus: derived.groupWinnerBonus,
        },
        computed,
        max: 400,
      };
    },
  },
  postseason: {
    label: "Knockout Stage",
    milestones: [
      { label: "Round of 32 Win", pts: 50 },
      { label: "Round of 16 Win", pts: 75 },
      { label: "Quarterfinal Win", pts: 100 },
      { label: "Semifinal Win", pts: 125 },
      { label: "Win the Final", pts: 250 },
    ],
    computeFromMilestones(milestones) {
      return Math.min(
        milestones.filter((m) => m.achieved).reduce((sum, m) => sum + m.pts, 0),
        600,
      );
    },
    buildBreakdown(milestones, computed) {
      return {
        label: "Knockout Stage",
        formula: "Cumulative knockout round bonuses",
        milestones: milestones.map((m) => ({
          label: m.label,
          pts: m.pts,
          achieved: m.achieved,
        })),
        computed,
        max: 600,
      };
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// NWSL
// ═══════════════════════════════════════════════════════════════

const nwslSchema = soccerTableSchema(
  90,
  [
    { label: "Win Quarterfinal", pts: 100 },
    { label: "Win Semifinal", pts: 200 },
    { label: "Win NWSL Championship", pts: 300 },
  ],
  "NWSL Playoffs (Single Elimination)",
);
// Override the sportType for NWSL-specific display
nwslSchema.regularSeason.buildBreakdown = function (inputs, computed, derived) {
  return {
    label: "NWSL Table Points",
    formula: `(tablePoints / 90) × 400`,
    inputs: {
      wins: inputs.wins || 0,
      draws: inputs.draws || 0,
      losses: inputs.losses || 0,
      gamesPlayed: derived.gamesPlayed,
      tablePoints: derived.tablePoints,
      maxTablePoints: 90,
    },
    computed,
    max: 400,
  };
};

// ═══════════════════════════════════════════════════════════════
// MASTER SCHEMA MAP — keyed by sport_id
// ═══════════════════════════════════════════════════════════════

export const SCORING_SCHEMAS = {
  // NBA (1)
  1: standardWinPctSchema(
    [
      { label: "Make Playoffs", pts: 60 },
      { label: "Advance to Round 2", pts: 90 },
      { label: "Conference Finals", pts: 120 },
      { label: "NBA Finals", pts: 150 },
      { label: "Win Championship", pts: 180 },
    ],
    "Playoff Advancement",
  ),

  // WNBA (2)
  2: standardWinPctSchema(
    [
      { label: "Make Playoffs", pts: 90 },
      { label: "Semifinals", pts: 130 },
      { label: "WNBA Finals", pts: 170 },
      { label: "Win Championship", pts: 210 },
    ],
    "Playoff Advancement",
  ),

  // NFL (3)
  3: standardWinPctSchema(
    [
      { label: "Make Playoffs", pts: 60 },
      { label: "Divisional Round", pts: 90 },
      { label: "Conference Championship", pts: 120 },
      { label: "Super Bowl", pts: 150 },
      { label: "Win Super Bowl", pts: 180 },
    ],
    "Playoff Advancement",
  ),

  // MLB (4)
  4: standardWinPctSchema(
    [
      { label: "Make Playoffs", pts: 60 },
      { label: "Division Series", pts: 90 },
      { label: "League Championship", pts: 120 },
      { label: "World Series", pts: 150 },
      { label: "Win World Series", pts: 180 },
    ],
    "Playoff Advancement",
  ),

  // NHL (5)
  5: nhlSchema,

  // MLS (6)
  6: soccerTableSchema(
    102,
    [
      { label: "Make Playoffs", pts: 60 },
      { label: "Advance to Round 2", pts: 90 },
      { label: "Conference Finals", pts: 120 },
      { label: "MLS Cup Finals", pts: 150 },
      { label: "Win MLS Cup", pts: 180 },
    ],
    "MLS Cup Playoffs",
  ),

  // NCAAW Volleyball (7)
  7: standardWinPctSchema(
    [
      { label: "Make NCAA Tournament", pts: 60 },
      { label: "Sweet 16", pts: 90 },
      { label: "Elite 8", pts: 120 },
      { label: "Final Four", pts: 150 },
      { label: "Win Championship", pts: 180 },
    ],
    "NCAA Tournament",
  ),

  // Premier League (8)
  8: soccerTableSchema(
    114,
    [
      { label: "UCL: Advance to Knockouts", pts: 20 },
      { label: "UCL: Quarterfinals", pts: 35 },
      { label: "UCL: Semifinals", pts: 55 },
      { label: "UCL: Finals", pts: 80 },
      { label: "UCL: Win", pts: 105 },
      { label: "FA Cup: Quarterfinals", pts: 20 },
      { label: "FA Cup: Semifinals", pts: 35 },
      { label: "FA Cup: Final", pts: 55 },
      { label: "FA Cup: Win", pts: 80 },
      { label: "Carabao Cup: Quarterfinals", pts: 10 },
      { label: "Carabao Cup: Semifinals", pts: 20 },
      { label: "Carabao Cup: Final", pts: 35 },
      { label: "Carabao Cup: Win", pts: 50 },
    ],
    "Cups & European Play",
  ),

  // College Football (9)
  9: standardWinPctSchema(
    [
      { label: "Make 12-Team CFP", pts: 50 },
      { label: "Quarterfinals", pts: 75 },
      { label: "Semifinals", pts: 100 },
      { label: "National Championship Game", pts: 150 },
      { label: "Win National Championship", pts: 225 },
    ],
    "CFP Postseason",
  ),

  // Men's CBB (10)
  10: standardWinPctSchema(
    [
      { label: "Round of 64", pts: 20 },
      { label: "Round of 32", pts: 40 },
      { label: "Sweet 16", pts: 60 },
      { label: "Elite 8", pts: 80 },
      { label: "Final Four", pts: 110 },
      { label: "Title Game", pts: 130 },
      { label: "National Champion", pts: 100 },
    ],
    "March Madness",
  ),

  // Women's CBB (11)
  11: standardWinPctSchema(
    [
      { label: "Round of 64", pts: 20 },
      { label: "Round of 32", pts: 40 },
      { label: "Sweet 16", pts: 60 },
      { label: "Elite 8", pts: 80 },
      { label: "Final Four", pts: 110 },
      { label: "Title Game", pts: 130 },
      { label: "National Champion", pts: 100 },
    ],
    "March Madness",
  ),

  // ATP Tennis (12)
  12: relativePointsSchema(
    "ATP Race Points (Relative to Leader)",
    "Tour Leader Points",
    "Athlete Tour Points",
    [
      {
        label: "Australian Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Round of 32", pts: 3.6 },
          { label: "Round of 16", pts: 7.1 },
          { label: "Quarterfinal", pts: 14.3 },
          { label: "Semifinal", pts: 28.6 },
          { label: "Final", pts: 39.2 },
          { label: "Winner", pts: 57.2 },
        ],
        selectedTier: 0,
      },
      {
        label: "French Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Round of 32", pts: 3.6 },
          { label: "Round of 16", pts: 7.1 },
          { label: "Quarterfinal", pts: 14.3 },
          { label: "Semifinal", pts: 28.6 },
          { label: "Final", pts: 39.2 },
          { label: "Winner", pts: 57.2 },
        ],
        selectedTier: 0,
      },
      {
        label: "Wimbledon",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Round of 32", pts: 3.6 },
          { label: "Round of 16", pts: 7.1 },
          { label: "Quarterfinal", pts: 14.3 },
          { label: "Semifinal", pts: 28.6 },
          { label: "Final", pts: 39.2 },
          { label: "Winner", pts: 57.2 },
        ],
        selectedTier: 0,
      },
      {
        label: "US Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Round of 32", pts: 3.6 },
          { label: "Round of 16", pts: 7.1 },
          { label: "Quarterfinal", pts: 14.3 },
          { label: "Semifinal", pts: 28.6 },
          { label: "Final", pts: 39.2 },
          { label: "Winner", pts: 57.2 },
        ],
        selectedTier: 0,
      },
    ],
    "Grand Slam Performance",
    "Rd32 (+3.6), Rd16 (+7.1), QF (+14.3), SF (+28.6), Final (+39.2), Win (+57.2) — per Major",
    "tennis_relative",
  ),

  // WTA Tennis (13)
  13: relativePointsSchema(
    "WTA Race Points (Relative to Leader)",
    "Tour Leader Points",
    "Athlete Tour Points",
    [
      {
        label: "Australian Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Round of 32", pts: 3.6 },
          { label: "Round of 16", pts: 7.1 },
          { label: "Quarterfinal", pts: 14.3 },
          { label: "Semifinal", pts: 28.6 },
          { label: "Final", pts: 39.2 },
          { label: "Winner", pts: 57.2 },
        ],
        selectedTier: 0,
      },
      {
        label: "French Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Round of 32", pts: 3.6 },
          { label: "Round of 16", pts: 7.1 },
          { label: "Quarterfinal", pts: 14.3 },
          { label: "Semifinal", pts: 28.6 },
          { label: "Final", pts: 39.2 },
          { label: "Winner", pts: 57.2 },
        ],
        selectedTier: 0,
      },
      {
        label: "Wimbledon",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Round of 32", pts: 3.6 },
          { label: "Round of 16", pts: 7.1 },
          { label: "Quarterfinal", pts: 14.3 },
          { label: "Semifinal", pts: 28.6 },
          { label: "Final", pts: 39.2 },
          { label: "Winner", pts: 57.2 },
        ],
        selectedTier: 0,
      },
      {
        label: "US Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Round of 32", pts: 3.6 },
          { label: "Round of 16", pts: 7.1 },
          { label: "Quarterfinal", pts: 14.3 },
          { label: "Semifinal", pts: 28.6 },
          { label: "Final", pts: 39.2 },
          { label: "Winner", pts: 57.2 },
        ],
        selectedTier: 0,
      },
    ],
    "Grand Slam Performance",
    "Rd32 (+3.6), Rd16 (+7.1), QF (+14.3), SF (+28.6), Final (+39.2), Win (+57.2) — per Major",
    "tennis_relative",
  ),

  // PGA Golf (14)
  14: relativePointsSchema(
    "FedEx Cup Points (Relative to Leader)",
    "Tour Leader Points",
    "Golfer Tour Points",
    [
      {
        label: "The Masters",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 15 },
          { label: "Top 10", pts: 30 },
          { label: "Top 5", pts: 45 },
          { label: "Winner", pts: 60 },
        ],
        selectedTier: 0,
      },
      {
        label: "PGA Championship",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 15 },
          { label: "Top 10", pts: 30 },
          { label: "Top 5", pts: 45 },
          { label: "Winner", pts: 60 },
        ],
        selectedTier: 0,
      },
      {
        label: "U.S. Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 15 },
          { label: "Top 10", pts: 30 },
          { label: "Top 5", pts: 45 },
          { label: "Winner", pts: 60 },
        ],
        selectedTier: 0,
      },
      {
        label: "The Open Championship",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 15 },
          { label: "Top 10", pts: 30 },
          { label: "Top 5", pts: 45 },
          { label: "Winner", pts: 60 },
        ],
        selectedTier: 0,
      },
    ],
    "Major Championship Performance",
    "Make Cut (+15), Top 10 (+30), Top 5 (+45), Win (+60) — per Major",
    "golf_relative",
  ),

  // LPGA Golf (15)
  15: relativePointsSchema(
    "Race to CME Globe Points (Relative to Leader)",
    "Tour Leader Points",
    "Golfer CME Points",
    [
      {
        label: "Chevron Championship",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 12 },
          { label: "Top 10", pts: 24 },
          { label: "Top 5", pts: 36 },
          { label: "Winner", pts: 48 },
        ],
        selectedTier: 0,
      },
      {
        label: "KPMG Women's PGA",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 12 },
          { label: "Top 10", pts: 24 },
          { label: "Top 5", pts: 36 },
          { label: "Winner", pts: 48 },
        ],
        selectedTier: 0,
      },
      {
        label: "U.S. Women's Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 12 },
          { label: "Top 10", pts: 24 },
          { label: "Top 5", pts: 36 },
          { label: "Winner", pts: 48 },
        ],
        selectedTier: 0,
      },
      {
        label: "The Evian Championship",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 12 },
          { label: "Top 10", pts: 24 },
          { label: "Top 5", pts: 36 },
          { label: "Winner", pts: 48 },
        ],
        selectedTier: 0,
      },
      {
        label: "AIG Women's Open",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not participate", pts: 0 },
          { label: "Made Cut", pts: 12 },
          { label: "Top 10", pts: 24 },
          { label: "Top 5", pts: 36 },
          { label: "Winner", pts: 48 },
        ],
        selectedTier: 0,
      },
    ],
    "Major Championship Performance",
    "Make Cut (+12), Top 10 (+24), Top 5 (+36), Win (+48) — per Major",
    "golf_relative",
  ),

  // Formula 1 (16)
  16: relativePointsSchema(
    "WDC Points (Relative to Leader)",
    "WDC Leader Points",
    "Driver WDC Points",
    [
      {
        label: "Monaco GP",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not score", pts: 0 },
          { label: "Points Finish", pts: 15 },
          { label: "Top 5", pts: 30 },
          { label: "Podium", pts: 45 },
          { label: "Race Win", pts: 60 },
        ],
        selectedTier: 0,
      },
      {
        label: "British GP",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not score", pts: 0 },
          { label: "Points Finish", pts: 15 },
          { label: "Top 5", pts: 30 },
          { label: "Podium", pts: 45 },
          { label: "Race Win", pts: 60 },
        ],
        selectedTier: 0,
      },
      {
        label: "Belgian GP",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not score", pts: 0 },
          { label: "Points Finish", pts: 15 },
          { label: "Top 5", pts: 30 },
          { label: "Podium", pts: 45 },
          { label: "Race Win", pts: 60 },
        ],
        selectedTier: 0,
      },
      {
        label: "Italian GP",
        type: "event",
        cumulative: true,
        tiers: [
          { label: "Did not score", pts: 0 },
          { label: "Points Finish", pts: 15 },
          { label: "Top 5", pts: 30 },
          { label: "Podium", pts: 45 },
          { label: "Race Win", pts: 60 },
        ],
        selectedTier: 0,
      },
    ],
    "Crown Jewel Races (British, Belgian, Monaco, Italian GPs)",
    "Points Finish (+15), Top 5 (+30), Podium (+45), Win (+60) — per race",
    "f1_relative",
  ),

  // MMA (17)
  17: mmaSchema,

  // NWSL (18)
  18: nwslSchema,

  // Summer Intl Soccer (19)
  19: summerIntlSchema,
};
