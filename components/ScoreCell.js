"use client";
import ScoreBreakdownModal from "./ScoreBreakdownModal";

/**
 * ScoreCell
 *
 * A thin client-side wrapper used inside the Server Component leaderboard table.
 * It renders the entity name + score as a clickable element that opens the
 * ScoreBreakdownModal.
 *
 * Props come from the Supabase query in page.js.
 */
export default function ScoreCell({
  entityName,
  sportName,
  regularScore,
  postseasonScore,
  totalScore,
  breakdown,
  lastUpdated,
}) {
  return (
    <ScoreBreakdownModal
      entityName={entityName}
      sportName={sportName}
      regularScore={regularScore}
      postseasonScore={postseasonScore}
      totalScore={totalScore}
      breakdown={breakdown}
      lastUpdated={lastUpdated}
    />
  );
}
