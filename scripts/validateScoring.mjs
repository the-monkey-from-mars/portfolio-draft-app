/**
 * validateScoring.mjs — checks every sport is worth exactly 400 + 600.
 * Run: npm run validate:scoring
 */
import {
  SCORING_SCHEMAS,
  summerIntlSchema32,
  maxPostseasonPath,
  REGULAR_SEASON_MAX,
  POSTSEASON_MAX,
} from "../lib/scoringSchemas.js";
import { SPORT_CONFIG } from "../lib/sportConfig.js";

const schemas = Object.entries(SCORING_SCHEMAS).map(([id, s]) => [
  SPORT_CONFIG[id]?.name || `Sport ${id}`,
  s,
]);
schemas.push(["Summer Intl Soccer (32-team years)", summerIntlSchema32]);

let failed = 0;
for (const [name, s] of schemas) {
  const reg = s.regularSeason.compute(s.regularSeason.maxInputs).score;
  const post = maxPostseasonPath(s);
  const ok = reg === REGULAR_SEASON_MAX && post === POSTSEASON_MAX;
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${name.padEnd(36)} regular ${reg}/400  postseason ${post}/600`);
}
if (failed) {
  console.error(`\n${failed} sport(s) do not add up to 1000.`);
  process.exit(1);
}
console.log("\nAll sports add up to 400 + 600 = 1000.");
