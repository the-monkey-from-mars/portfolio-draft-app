"use client";
import { useState } from "react";

/**
 * ScoreBreakdownModal
 *
 * A generic renderer for the score_breakdown JSONB stored per roster pick.
 * Think of it like a receipt printer — it doesn't know what's being sold,
 * it just formats whatever line items are on the receipt.
 *
 * The breakdown JSON convention:
 *   - regularSeason.inputs: key-value pairs displayed as stat rows
 *   - regularSeason.formula: human-readable formula string
 *   - postseason.milestones: array of { label, pts, achieved, detail? }
 *
 * This component doesn't hardcode any sport-specific logic. If you change
 * a sport's scoring rules, just update the cron script's breakdown output
 * and this modal adapts automatically.
 */

// Mapping of raw input keys to human-friendly labels
const INPUT_LABELS = {
  wins: "Wins",
  losses: "Losses",
  draws: "Draws",
  ties: "Draws",
  gamesPlayed: "Games Played",
  winPct: "Win %",
  tablePoints: "Table Points",
  maxTablePoints: "Max Table Points",
  otLosses: "OT Losses",
  goalDifference: "Goal Diff",
  driverPoints: "WDC Points",
  leaderPoints: "Leader Points",
  leaderName: "Tour Leader",
  driverRank: "Championship Rank",
  athletePoints: "Tour Points",
  athleteRank: "Tour Rank",
  groupRank: "Group Position",
  isGroupWinner: "Group Winner",
  groupWinnerBonus: "Group Winner Bonus",
  totalWins: "Total Wins",
  totalFights: "Total Fights",
};

// Format values nicely for display
function formatValue(key, value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "winPct") return `${(value * 100).toFixed(1)}%`;
  if (typeof value === "number" && !Number.isInteger(value))
    return value.toFixed(1);
  return String(value);
}

// Render the inputs section based on sport type
function renderInputs(inputs, sportType) {
  if (!inputs) return null;

  // For MMA, render the fight log differently
  if (sportType === "mma_fight_log" && inputs.fights) {
    return (
      <div className="space-y-2">
        {/* Summary stats */}
        <div className="flex justify-between text-sm py-1 border-b border-gray-700/50">
          <span className="text-gray-400">Total Fights</span>
          <span className="text-white font-medium">{inputs.totalFights}</span>
        </div>
        <div className="flex justify-between text-sm py-1 border-b border-gray-700/50">
          <span className="text-gray-400">Wins</span>
          <span className="text-white font-medium">{inputs.totalWins}</span>
        </div>
        {/* Individual fights */}
        {inputs.fights.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Fight Log
            </p>
            {inputs.fights.map((fight, idx) => (
              <div
                key={idx}
                className={`flex justify-between items-center text-sm py-2 px-3 rounded mb-1 ${
                  fight.result === "Win"
                    ? "bg-green-900/20 border border-green-800/30"
                    : "bg-red-900/20 border border-red-800/30"
                }`}
              >
                <div>
                  <span
                    className={`font-bold mr-2 ${fight.result === "Win" ? "text-green-400" : "text-red-400"}`}
                  >
                    {fight.result}
                  </span>
                  <span className="text-gray-300">
                    vs. {fight.opponent || "Unknown"}
                  </span>
                  <div className="flex gap-2 mt-1">
                    {fight.isMainEvent && (
                      <span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-1.5 py-0.5 rounded">
                        Main Event
                      </span>
                    )}
                    {fight.isOpponentTop5 && (
                      <span className="text-[10px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">
                        Top 5 Opponent
                      </span>
                    )}
                    {fight.isTitleFight && (
                      <span className="text-[10px] bg-purple-900/40 text-purple-400 px-1.5 py-0.5 rounded">
                        Title Fight
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {fight.regPoints > 0 && (
                    <div className="text-green-400 text-xs">
                      +{fight.regPoints} reg
                    </div>
                  )}
                  {fight.bonusPoints > 0 && (
                    <div className="text-yellow-400 text-xs">
                      +{fight.bonusPoints} bonus
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {inputs.fights.length === 0 && (
          <p className="text-gray-500 text-sm italic mt-2">
            No fights recorded yet this season.
          </p>
        )}
      </div>
    );
  }

  // Standard key-value rendering for all other sports
  const displayKeys = Object.keys(inputs).filter(
    (key) =>
      key !== "fights" && inputs[key] !== null && inputs[key] !== undefined,
  );

  return (
    <div className="space-y-0.5">
      {displayKeys.map((key) => (
        <div
          key={key}
          className="flex justify-between text-sm py-1.5 border-b border-gray-700/30"
        >
          <span className="text-gray-400">
            {INPUT_LABELS[key] || key.replace(/([A-Z])/g, " $1").trim()}
          </span>
          <span className="text-white font-medium">
            {formatValue(key, inputs[key])}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ScoreBreakdownModal({
  entityName,
  sportName,
  regularScore,
  postseasonScore,
  totalScore,
  breakdown,
  lastUpdated,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const hasBreakdown = breakdown && breakdown.regularSeason;

  return (
    <>
      {/* Clickable trigger — the score display */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full group text-center"
        title={
          hasBreakdown
            ? "Click for score breakdown"
            : "Breakdown not yet available"
        }
      >
        <div className="font-semibold text-gray-200 group-hover:text-white transition">
          {entityName || (
            <span className="text-gray-500 italic">Pending...</span>
          )}
        </div>
        <div className="text-green-400 text-xs mt-1 font-bold group-hover:text-green-300 transition inline-flex items-center gap-1">
          {totalScore || 0} pts
          {hasBreakdown && (
            <svg
              className="w-3 h-3 text-gray-500 group-hover:text-gray-300 transition"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-lg w-full relative shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-700 flex-shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold leading-none"
              >
                &times;
              </button>
              <h2 className="text-xl font-bold text-white pr-8">
                {entityName}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{sportName}</p>

              {/* Score summary bar */}
              <div className="flex gap-3 mt-4">
                <div className="flex-1 bg-gray-800 rounded-lg p-3 text-center border border-gray-700">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Regular
                  </div>
                  <div className="text-lg font-bold text-blue-400 mt-1">
                    {regularScore || 0}
                    <span className="text-gray-600 text-xs font-normal">
                      /400
                    </span>
                  </div>
                </div>
                <div className="flex-1 bg-gray-800 rounded-lg p-3 text-center border border-gray-700">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Postseason
                  </div>
                  <div className="text-lg font-bold text-yellow-400 mt-1">
                    {postseasonScore || 0}
                    <span className="text-gray-600 text-xs font-normal">
                      /600
                    </span>
                  </div>
                </div>
                <div className="flex-1 bg-gray-800 rounded-lg p-3 text-center border border-green-800/50">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Total
                  </div>
                  <div className="text-lg font-bold text-green-400 mt-1">
                    {totalScore || 0}
                    <span className="text-gray-600 text-xs font-normal">
                      /1000
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-grow p-5 space-y-6">
              {!hasBreakdown ? (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-lg mb-2">No breakdown available yet</p>
                  <p className="text-sm">
                    The breakdown will appear after the next daily score update
                    runs.
                  </p>
                </div>
              ) : (
                <>
                  {/* Regular Season Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-blue-400 text-sm uppercase tracking-wide">
                        {breakdown.regularSeason.label}
                      </h3>
                      <span className="text-blue-400 font-bold">
                        {breakdown.regularSeason.computed}
                        <span className="text-gray-600 text-xs font-normal">
                          /{breakdown.regularSeason.max}
                        </span>
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((breakdown.regularSeason.computed / breakdown.regularSeason.max) * 100, 100)}%`,
                        }}
                      />
                    </div>

                    {/* Formula */}
                    <div className="bg-gray-800/50 rounded px-3 py-2 mb-3 border border-gray-700/50">
                      <span className="text-xs text-gray-500">Formula: </span>
                      <span className="text-xs text-gray-300 font-mono">
                        {breakdown.regularSeason.formula}
                      </span>
                    </div>

                    {/* Inputs */}
                    {renderInputs(
                      breakdown.regularSeason.inputs,
                      breakdown.sportType,
                    )}
                  </div>

                  {/* Postseason Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-yellow-400 text-sm uppercase tracking-wide">
                        {breakdown.postseason.label}
                      </h3>
                      <span className="text-yellow-400 font-bold">
                        {breakdown.postseason.computed}
                        <span className="text-gray-600 text-xs font-normal">
                          /{breakdown.postseason.max}
                        </span>
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((breakdown.postseason.computed / breakdown.postseason.max) * 100, 100)}%`,
                        }}
                      />
                    </div>

                    {/* Formula */}
                    <div className="bg-gray-800/50 rounded px-3 py-2 mb-3 border border-gray-700/50">
                      <span className="text-xs text-gray-500">Formula: </span>
                      <span className="text-xs text-gray-300 font-mono">
                        {breakdown.postseason.formula}
                      </span>
                    </div>

                    {/* Milestones */}
                    {breakdown.postseason.milestones &&
                      breakdown.postseason.milestones.length > 0 && (
                        <div className="space-y-1.5">
                          {breakdown.postseason.milestones.map(
                            (milestone, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center justify-between text-sm py-2 px-3 rounded border ${
                                  milestone.achieved
                                    ? "bg-green-900/20 border-green-800/40"
                                    : "bg-gray-800/30 border-gray-700/30"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-base ${milestone.achieved ? "" : "opacity-30"}`}
                                  >
                                    {milestone.achieved ? "✅" : "⬜"}
                                  </span>
                                  <span
                                    className={
                                      milestone.achieved
                                        ? "text-green-300 font-medium"
                                        : "text-gray-500"
                                    }
                                  >
                                    {milestone.label}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span
                                    className={`font-bold ${
                                      milestone.achieved
                                        ? "text-green-400"
                                        : "text-gray-600"
                                    }`}
                                  >
                                    +{milestone.pts}
                                  </span>
                                  {milestone.detail && (
                                    <div className="text-[10px] text-gray-600 mt-0.5">
                                      {milestone.detail}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-700 flex-shrink-0 flex justify-between items-center">
              <span className="text-xs text-gray-600">
                {lastUpdated
                  ? `Updated ${new Date(lastUpdated).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                  : ""}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-gray-400 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
