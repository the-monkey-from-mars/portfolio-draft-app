import { supabase } from "../lib/supabase";
import Link from "next/link";
import { SPORT_CONFIG } from "../lib/sportConfig";
import RulesModal from "../components/RulesModal";
import WaiverRulesModal from "../components/WaiverRulesModal";
import DraftResultsModal from "../components/DraftResultsModal";
import YearDropdown from "../components/YearDropdown";
import MobileNav from "../components/MobileNav";
import ScoreCell from "../components/ScoreCell";

export const revalidate = 0;

// 1. The Draft Date Dictionary (Super Bowl Mondays)
const DRAFT_DATES = {
  "2026-2027": { label: "Inaugural Draft", date: "03/01/2026" },
  "2027-2028": { label: "Rollover Draft", date: "02/15/2027" },
  "2028-2029": { label: "Rollover Draft", date: "02/14/2028" },
  "2029-2030": { label: "Rollover Draft", date: "02/12/2029" },
};

export default async function Home({ searchParams }) {
  // Safely await searchParams (Required for Next.js 15+)
  const params = await searchParams;
  const selectedYear = params?.year || "2026-2027";

  // Get the draft info for the selected year (or default to TBD)
  const draftInfo = DRAFT_DATES[selectedYear] || {
    label: "Rollover Draft",
    date: "TBD",
  };

  // Fetch active users
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("is_active", true);

  // Fetch roster picks ONLY for the selected portfolio year
  // NOW includes score_breakdown, regular_season_score, postseason_score, and last_updated_at
  const { data: rosterPicks } = await supabase
    .from("roster_picks")
    .select(
      `user_id, sport_id, total_score, regular_season_score, postseason_score, score_breakdown, last_updated_at, entities (display_name)`,
    )
    .eq("portfolio_year", selectedYear);

  // Sort the sports chronologically for the table columns
  const sortedSports = Object.entries(SPORT_CONFIG)
    .map(([id, config]) => ({ id: Number(id), ...config }))
    .sort((a, b) => a.order - b.order);

  // Sort users by total cumulative points (descending)
  const sortedUsers = [...(users || [])].sort((a, b) => {
    const aTotal = (rosterPicks || [])
      .filter((p) => p.user_id === a.id)
      .reduce((sum, p) => sum + (Number(p.total_score) || 0), 0);
    const bTotal = (rosterPicks || [])
      .filter((p) => p.user_id === b.id)
      .reduce((sum, p) => sum + (Number(p.total_score) || 0), 0);
    return bTotal - aTotal;
  });

  return (
    <main className="p-4 md:p-8 text-white min-h-screen bg-gray-950">
      {/* Mobile header */}
      <div className="md:hidden mb-6">
        <div className="flex items-center justify-between mb-3">
          <MobileNav />
          <h1 className="text-xl font-bold text-center flex-1 mx-3">
            Sports Portfolio Supremacy
          </h1>
          <YearDropdown currentYear={selectedYear} />
        </div>
        <p className="text-gray-400 text-sm text-center">
          <span>Live Leaderboard</span>
          <span className="mx-2 text-gray-600">|</span>
          {selectedYear === "2026-2027" ? (
            <DraftResultsModal />
          ) : (
            <span className="text-yellow-500 font-semibold tracking-wide">
              {draftInfo.label}:{" "}
              <span className="text-white">{draftInfo.date}</span>
            </span>
          )}
        </p>
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center">
            <h1 className="text-3xl font-bold">Sports Portfolio Supremacy</h1>
            <YearDropdown currentYear={selectedYear} />
          </div>
          <p className="text-gray-400 mt-2 flex items-center">
            Live Leaderboard
            <span className="mx-3 text-gray-600">|</span>
            {selectedYear === "2026-2027" ? (
              <DraftResultsModal />
            ) : (
              <span className="text-yellow-500 font-semibold tracking-wide">
                {draftInfo.label}:{" "}
                <span className="text-white">{draftInfo.date}</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex space-x-4">
          <RulesModal />
          <WaiverRulesModal />
          <Link
            href="/office"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition"
          >
            Manager Office
          </Link>
          <Link
            href="/admin"
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition"
          >
            Admin Draft Room
          </Link>
        </div>
      </div>

      {/* The Master Matrix */}
      <div className="overflow-x-auto rounded-lg shadow-2xl border border-gray-700">
        <table className="min-w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-gray-900 text-gray-300 font-bold uppercase">
            <tr>
              <th className="px-6 py-4 sticky left-0 bg-gray-900 z-10 border-b border-r border-gray-700 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                Manager
              </th>

              {sortedSports.map((sport) => (
                <th
                  key={sport.id}
                  className="px-6 py-4 border-b border-gray-700 text-center min-w-[200px]"
                >
                  <div className="flex flex-col items-center">
                    <span>{sport.name}</span>

                    <span className="text-xs text-blue-400 font-normal mt-1">
                      {sport.dates}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800 bg-gray-800">
            {sortedUsers.map((user, index) => {
              const userPicks =
                rosterPicks?.filter((p) => p.user_id === user.id) || [];

              const userTotalScore = userPicks.reduce(
                (sum, p) => sum + (Number(p.total_score) || 0),
                0,
              );

              return (
                <tr
                  key={user.id}
                  className="odd:bg-gray-800 even:bg-gray-900 border-b-2 border-gray-600 hover:bg-gray-700 transition"
                >
                  {/* Sticky User Column */}
                  <td className="px-6 py-4 sticky left-0 bg-gray-800 z-10 border-r border-gray-700 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm font-mono">
                        {index + 1}.
                      </span>
                      <Link
                        href={`/user/${user.id}`}
                        className="font-bold text-lg text-white hover:underline"
                      >
                        {user.name}
                      </Link>
                    </div>

                    <div className="text-green-400 font-bold mt-1 text-base">
                      {userTotalScore} pts
                    </div>
                  </td>

                  {/* Sport Columns */}
                  {sortedSports.map((sport) => {
                    const sportPicks = userPicks.filter(
                      (p) => p.sport_id === sport.id,
                    );

                    return (
                      <td key={sport.id} className="px-6 py-4 text-center">
                        {sportPicks.length > 0 ? (
                          sportPicks.map((pick, i) => (
                            <div
                              key={i}
                              className={
                                i > 0
                                  ? "mt-3 pt-3 border-t border-gray-700"
                                  : ""
                              }
                            >
                              <ScoreCell
                                entityName={
                                  pick.entities
                                    ? pick.entities.display_name
                                    : null
                                }
                                sportName={sport.name}
                                regularScore={
                                  Number(pick.regular_season_score) || 0
                                }
                                postseasonScore={
                                  Number(pick.postseason_score) || 0
                                }
                                totalScore={Number(pick.total_score) || 0}
                                breakdown={pick.score_breakdown}
                                lastUpdated={pick.last_updated_at}
                              />
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-600 italic">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
