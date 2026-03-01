import { supabase } from "../lib/supabase";
import Link from "next/link";
import { SPORT_CONFIG } from "../lib/sportConfig";
import RulesModal from "../components/RulesModal";

export const revalidate = 0;

export default async function Home() {
  // Fetch active users
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("is_active", true);

  // Fetch all roster picks with the team names included
  const { data: rosterPicks } = await supabase
    .from("roster_picks")
    .select(`user_id, sport_id, total_score, entities (display_name)`);

  // Sort the sports chronologically for the table columns
  const sortedSports = Object.entries(SPORT_CONFIG)
    .map(([id, config]) => ({ id: Number(id), ...config }))
    .sort((a, b) => a.order - b.order);

  return (
    <main className="p-8 text-white min-h-screen bg-gray-950">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Sports Portfolio Supremacy</h1>
          <p className="text-gray-400 mt-2">Live Leaderboard</p>
        </div>
        <div className="flex space-x-4">
          {" "}
          {/* Added a wrapper for spacing */}
          <RulesModal />
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
            {users?.map((user) => {
              const userPicks =
                rosterPicks?.filter((p) => p.user_id === user.id) || [];
              const userTotalScore = userPicks.reduce(
                (sum, p) => sum + (Number(p.total_score) || 0),
                0,
              );

              return (
                <tr key={user.id} className="hover:bg-gray-700 transition">
                  {/* Sticky User Column */}
                  <td className="px-6 py-4 sticky left-0 bg-gray-800 z-10 border-r border-gray-700 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                    <Link
                      href={`/user/${user.id}`}
                      className="font-bold text-lg text-white hover:underline"
                    >
                      {user.name}
                    </Link>
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
                              <div className="font-semibold text-gray-200">
                                {pick.entities ? (
                                  pick.entities.display_name
                                ) : (
                                  <span className="text-gray-500 italic">
                                    Pending...
                                  </span>
                                )}
                              </div>
                              <div className="text-green-400 text-xs mt-1 font-bold">
                                {Number(pick.total_score) || 0} pts
                              </div>
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
