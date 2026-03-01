import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import { SPORT_CONFIG } from "../../../lib/sportConfig";

export const revalidate = 0;

export default async function UserProfile({ params }) {
  const resolvedParams = await params;
  const userId = resolvedParams.id;

  const { data: user } = await supabase
    .from("users")
    .select("name")
    .eq("id", userId)
    .single();

  const { data: roster } = await supabase
    .from("roster_picks")
    .select(
      `id, api_season_year, sport_id, sports (name), entities (display_name), total_score`,
    )
    .eq("user_id", userId);

  // Sort the grid chronologically using the config
  const sortedRoster = roster?.sort((a, b) => {
    const orderA = SPORT_CONFIG[a.sport_id]?.order || 99;
    const orderB = SPORT_CONFIG[b.sport_id]?.order || 99;
    return orderA - orderB;
  });

  return (
    <main className="p-10 text-white min-h-screen bg-gray-950">
      <Link
        href="/"
        className="text-blue-400 hover:underline mb-6 inline-block"
      >
        &larr; Back to Leaderboard
      </Link>

      <h1 className="text-3xl font-bold mb-8">{user?.name}&apos;s Portfolio</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRoster?.map((pick) => (
          <div
            key={pick.id}
            className="p-5 bg-gray-900 border border-gray-700 rounded shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-300">
                  {pick.sports.name}
                </h3>
                <span className="text-xs font-bold text-blue-300 bg-blue-900/40 px-2 py-1 rounded">
                  {SPORT_CONFIG[pick.sport_id]?.dates}
                </span>
              </div>

              {pick.entities ? (
                <p className="mt-2 text-xl font-bold text-white">
                  {pick.entities.display_name}
                </p>
              ) : (
                <p className="mt-2 text-gray-500 italic">Pending Draft...</p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-end">
              <span className="text-sm text-gray-400">Total Score:</span>
              <span className="text-xl font-bold text-green-400">
                {Number(pick.total_score) || 0}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
