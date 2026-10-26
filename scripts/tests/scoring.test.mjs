/**
 * Offline tests for the scoring pipeline. No network: fetch is stubbed with
 * fixtures shaped like ESPN's real responses.
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCORING_SCHEMAS,
  hydrateMilestones,
  scorePick,
} from "../../lib/scoringSchemas.js";
import {
  winPctInputs,
  tablePointsInputs,
  scheduleRecordInputs,
  namesMatch,
} from "../sports/espn.js";
import { f1Inputs, crownJewelMilestones } from "../sports/f1.js";

const fixtures = new Map();
globalThis.fetch = async (url) => {
  const key = [...fixtures.keys()].find((k) => url.startsWith(k));
  if (!key) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => fixtures.get(key) };
};

const stat = (name, value, extra = {}) => ({ name, value, ...extra });

test("college football: overall record parsed when winPercent is missing", async () => {
  fixtures.set("https://example.test/cfb", {
    children: [
      {
        name: "Big Ten",
        standings: {
          season: 2026,
          entries: [
            {
              team: { id: "2483" },
              stats: [
                stat("wins", 7),
                stat("leagueWinPercent", 1),
                { name: "overall", type: "total", summary: "7-1" },
              ],
            },
          ],
        },
      },
    ],
  });
  const { inputs } = await winPctInputs("https://example.test/cfb", 2026, "2483");
  assert.deepEqual(inputs, { wins: 7, losses: 1, ties: 0 });
  const r = scorePick(SCORING_SCHEMAS[9], inputs, hydrateMilestones(SCORING_SCHEMAS[9], null));
  assert.equal(r.regularSeasonScore, 350); // .875 × 400
});

test("NFL ties count as half a win", async () => {
  const inputs = { wins: 10, losses: 6, ties: 1 };
  const r = scorePick(SCORING_SCHEMAS[3], inputs, hydrateMilestones(SCORING_SCHEMAS[3], null));
  assert.equal(r.regularSeasonScore, Math.round((10.5 / 17) * 400));
});

test("NHL uses ESPN table points over 168", async () => {
  fixtures.set("https://example.test/nhl", {
    children: [
      {
        standings: {
          entries: [
            {
              team: { id: "7" },
              stats: [stat("wins", 9), stat("losses", 2), stat("OTLosses", 2), stat("points", 20)],
            },
          ],
        },
      },
    ],
  });
  const { inputs } = await tablePointsInputs("https://example.test/nhl", 2027, "7", "hockey");
  const r = scorePick(SCORING_SCHEMAS[5], inputs, hydrateMilestones(SCORING_SCHEMAS[5], null));
  assert.equal(r.regularSeasonScore, Math.round((20 / 168) * 400)); // 48
});

test("volleyball record counted from schedule, postseason excluded", async () => {
  const game = (winner, type = 2, completed = true) => ({
    seasonType: { type },
    competitions: [
      {
        status: { type: { completed } },
        competitors: [
          { team: { id: "251" }, winner },
          { team: { id: "999" }, winner: !winner },
        ],
      },
    ],
  });
  fixtures.set(
    "https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/teams/251/schedule",
    { events: [game(true), game(false), game(true), game(true, 3), game(undefined, 2, false)] },
  );
  const { inputs } = await scheduleRecordInputs("volleyball/womens-college-volleyball", 2026, "251");
  assert.deepEqual(inputs, { wins: 2, losses: 1, ties: 0 });
});

test("postseason milestones saved by admin survive a nightly rescore", () => {
  const s = SCORING_SCHEMAS[4]; // MLB
  const saved = {
    milestones: [
      { label: "Make Playoffs", pts: 60, achieved: true },
      { label: "Division Series", pts: 90, achieved: true },
      { label: "League Championship", pts: 120, achieved: true },
    ],
  };
  const r = scorePick(s, { wins: 100, losses: 62 }, hydrateMilestones(s, saved));
  assert.equal(r.regularSeasonScore, 247); // Dodgers
  assert.equal(r.postseasonScore, 270);
  assert.equal(r.totalScore, 517);
});

test("World Cup: France 3-0-0 group winner = 400; England 3rd place counts", () => {
  const s = SCORING_SCHEMAS[19];
  const france = scorePick(s, { wins: 3, draws: 0, losses: 0, isGroupWinner: true }, hydrateMilestones(s, null));
  assert.equal(france.regularSeasonScore, 400);
  const england = hydrateMilestones(s, {
    milestones: ["Round of 32 Win", "Round of 16 Win", "Quarterfinal Win", "3rd Place Match Win"].map(
      (label) => ({ label, achieved: true }),
    ),
  });
  assert.equal(s.postseason.computeFromMilestones(england), 300);
});

test("event tiers round-trip through the breakdown (admin ↔ cron)", () => {
  const s = SCORING_SCHEMAS[8]; // Premier League
  const ms = s.postseason.milestones.map((m) =>
    m.label === "European Competition"
      ? { ...m, selectedTier: m.tiers.findIndex((t) => t.label === "Europa: Semifinals") }
      : m.label === "FA Cup"
        ? { ...m, selectedTier: 2 }
        : { ...m, selectedTier: 0 },
  );
  const first = scorePick(s, { wins: 0 }, ms);
  const again = scorePick(s, { wins: 0 }, hydrateMilestones(s, first.breakdown.postseason));
  assert.equal(first.postseasonScore, 72.6 + 55); // Europa SF (110 × .66) + FA Cup SF
  assert.equal(again.postseasonScore, first.postseasonScore);
});

test("F1: Crown Jewel GP points removed from regular season, awarded as postseason", async () => {
  const driver = (name, pts, rank) => ({
    athlete: { displayName: name },
    stats: [stat("championshipPts", pts), stat("rank", rank)],
  });
  fixtures.set("https://site.api.espn.com/apis/v2/sports/racing/f1/standings", {
    children: [
      {
        standings: {
          season: 2026,
          entries: [
            driver("Kimi Antonelli", 365, 1),
            driver("George Russell", 242, 2),
            driver("Lewis Hamilton", 241, 3),
            driver("Max Verstappen", 236, 4),
            driver("Charles Leclerc", 233, 5),
            driver("Lando Norris", 211, 6),
            driver("Oscar Piastri", 144, 7),
            driver("Isack Hadjar", 105, 8),
            driver("Fernando Alonso", 7, 18),
            // Other Crown Jewel finishers (keeps the name-match check quiet)
            ...["Liam Lawson", "Arvid Lindblad", "Pierre Gasly", "Alexander Albon",
                "Esteban Ocon", "Gabriel Bortoleto", "Franco Colapinto", "Yuki Tsunoda"]
              .map((n, i) => driver(n, 40, 9 + i)),
          ],
        },
      },
    ],
  });
  const s = SCORING_SCHEMAS[16];
  const expected = {
    "Andrea Kimi Antonelli": [400, 450],
    "George Russell": [284, 180],
    "Lewis Hamilton": [259, 240],
    "Max Verstappen": [284, 180],
    "Charles Leclerc": [262, 240],
    "Lando Norris": [250, 105],
    "Oscar Piastri": [154, 135],
    "Isack Hadjar": [99, 150],
    "Fernando Alonso": [8, 15],
  };
  for (const [name, [reg, post]] of Object.entries(expected)) {
    const { inputs } = await f1Inputs(2026, name);
    const r = scorePick(s, inputs, crownJewelMilestones(s, 2026, name));
    assert.equal(r.regularSeasonScore, reg, `${name} regular`);
    assert.equal(r.postseasonScore, post, `${name} postseason`);
  }
});

test("college football: bowl win is half a CFP first-round win; regular season unaffected", () => {
  const s = SCORING_SCHEMAS[9];
  const bowl = hydrateMilestones(s, {
    milestones: [{ label: "Win Non-CFP Bowl Game", achieved: true }],
  });
  const r = scorePick(s, { wins: 9, losses: 3 }, bowl);
  assert.equal(r.regularSeasonScore, 300); // 9-3 regular season only
  assert.equal(r.postseasonScore, 37.5);
  assert.equal(r.totalScore, 337.5);
  // Ticking both by mistake only counts the larger of the two
  const both = hydrateMilestones(s, {
    milestones: [
      { label: "Win Non-CFP Bowl Game", achieved: true },
      { label: "Make 12-Team CFP", achieved: true },
    ],
  });
  assert.equal(s.postseason.computeFromMilestones(both), 50);
});

test("name matching", () => {
  assert.ok(namesMatch("Andrea Kimi Antonelli", "Kimi Antonelli"));
  assert.ok(namesMatch("Nico Hülkenberg", "Nico Hulkenberg"));
  assert.ok(!namesMatch("Carlos Sainz", "Carlos Alcaraz"));
});
