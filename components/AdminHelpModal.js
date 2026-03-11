"use client";
import { useState } from "react";

export default function AdminHelpModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm bg-gray-700 hover:bg-gray-600 text-white py-1 px-3 rounded transition"
      >
        Admin Offseason Guide
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-xl w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
            >
              &times;
            </button>

            <h2 className="text-xl font-bold text-red-400 mb-4">
              Offseason / New Year Checklist
            </h2>

            <div className="space-y-4 text-gray-300 text-sm max-h-[75vh] overflow-y-auto pr-2 pb-6">
              <div className="p-3 bg-gray-800 rounded border border-gray-700">
                <h3 className="font-bold text-white mb-1">
                  1. Syncing Promoted Teams (Upsert)
                </h3>
                <p>
                  Do <strong className="text-red-400">NOT</strong> use the SQL
                  `DELETE` command on leagues with relegation (like the Premier
                  League). Deleting relegated teams will break historical
                  rosters. Simply click the &quot;Sync&quot; button again in the
                  month before the new season to append newly promoted teams to
                  the dictionary.
                </p>
              </div>

              <div className="p-3 bg-gray-800 rounded border border-gray-700">
                <h3 className="font-bold text-white mb-1">
                  2. Creating the New Contest Year & Portfolios
                </h3>
                <p className="mb-2">
                  Before drafting, go to the Supabase SQL Editor and insert a
                  new portfolio class: <br />
                  <code className="text-xs bg-black p-1 rounded mt-1 block text-green-400">
                    INSERT INTO portfolios (name) VALUES (&apos;Class of
                    27-28&apos;);
                  </code>
                </p>
                <div className="mt-3 p-2 bg-gray-900 border border-blue-900/50 rounded">
                  <p className="text-blue-400 font-bold mb-1">
                    🔮 Future Code Update:
                  </p>
                  <p className="text-xs">
                    Once the new draft happens, you will want to add a{" "}
                    <code>portfolio_id</code> column to your{" "}
                    <code>roster_picks</code> table. Then, update the
                    `app/page.js` fetch logic to filter by that{" "}
                    <code>portfolio_id</code> instead of pulling all historical
                    database records at once!
                  </p>
                </div>
              </div>

              <div className="p-3 bg-gray-800 rounded border border-gray-700">
                <h3 className="font-bold text-white mb-1">
                  3. Automated GitHub Script
                </h3>
                <p>
                  Ensure your `daily-update.yml` Cron Job in GitHub is enabled.
                  If you need to pause updates during a dead period in the
                  summer, you can disable the workflow directly in the GitHub
                  Actions tab.
                </p>
              </div>

              <div className="p-3 bg-gray-800 rounded border border-gray-700">
                <h3 className="font-bold text-white mb-1">
                  4. Postseason & High-Leverage Math (The 600 Valuable Points)
                </h3>
                <p>
                  Currently, the backend micro-scripts have all postseason
                  scores explicitly set to <code>0</code>. As leagues enter the
                  playoffs or major tournaments occur, you will need to open the
                  specific script in the <code>scripts/sports/</code> folder and
                  update the code to capture bracket advancements or major
                  finishes.
                </p>
              </div>

              <div className="p-3 bg-gray-800 rounded border border-gray-700">
                <h3 className="font-bold text-white mb-1">
                  5. MMA (UFC) Manual Data
                </h3>
                <p>
                  Because free APIs rarely provide metadata like &quot;Title
                  Fights&quot; or &quot;Top 5 Opponents,&quot; MMA cannot be
                  fully automated through ESPN. When you are ready, you will
                  need to create a dedicated Supabase table to manually log
                  fight results, and point your backend scripts to read from
                  those tables.
                </p>
              </div>

              <div className="p-3 bg-gray-900 rounded border border-yellow-600/50">
                <h3 className="font-bold text-yellow-500 mb-2 border-b border-gray-700 pb-1">
                  6. Phase 3: The Waiver Wire Rollover
                </h3>
                <p className="mb-3">
                  After the February Mega-Draft is complete and the new
                  season-year has officially begun, the Commissioner must reset
                  the Waiver Wire engine for the upcoming calendar year.
                </p>
                <ol className="list-decimal pl-5 text-gray-400 space-y-2">
                  <li>
                    <strong className="text-white">Reset Priorities:</strong> Go
                    to the Supabase <code>users</code> table and manually update
                    the <code>waiver_priority</code> column based on the new
                    draft order (1 gets first dibs).
                  </li>
                  <li>
                    <strong className="text-white">Set New Deadlines:</strong>{" "}
                    Open the Supabase SQL Editor and run the annual UPDATE
                    script to set the exact <code>waiver_deadline</code>{" "}
                    timestamps for all 19 sports (including NWSL and Summer Intl
                    Soccer).
                  </li>
                  <li>
                    <strong className="text-white">
                      Clear Old Claims (Optional):
                    </strong>{" "}
                    You can delete or archive the previous year&apos;s{" "}
                    <code>waiver_claims</code> to keep the database clean,
                    though the bot will automatically ignore them if the dates
                    are past.
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-gray-900 rounded border border-green-600/50">
                <h3 className="font-bold text-green-400 mb-2 border-b border-gray-700 pb-1">
                  7. Summer International Soccer — Annual Rotation
                </h3>
                <p className="mb-3">
                  This sport rotates its tournament every year. Before seeding,
                  confirm which tournament applies:
                </p>
                <ul className="list-disc pl-5 text-gray-400 space-y-1">
                  <li>
                    <strong className="text-white">2026:</strong> FIFA
                    Men&apos;s World Cup (48 teams, <code>fifa.world</code>)
                  </li>
                  <li>
                    <strong className="text-white">2027:</strong> FIFA
                    Women&apos;s World Cup (32 teams, <code>fifa.wwc</code>)
                  </li>
                  <li>
                    <strong className="text-white">2028:</strong> UEFA Euro +
                    Copa América (40 teams combined)
                  </li>
                  <li>
                    <strong className="text-white">2029:</strong> CONCACAF Gold
                    Cup + Women&apos;s Euro (32 teams combined)
                  </li>
                  <li>
                    <strong className="text-white">2030:</strong> FIFA
                    Men&apos;s World Cup again (cycle repeats)
                  </li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">
                  The team lists in the Admin Seeding panel are pre-loaded per
                  year. Use the year dropdown to pick the correct tournament,
                  then click Seed. The <code>SUMMER_INTL_SOCCER_CONFIG</code> in{" "}
                  <code>lib/sportConfig.js</code> controls which ESPN slug the
                  cron job uses, so update that config if you adjust
                  tournaments. National team rosters may also need updating as
                  qualifiers finalize — just re-seed to append new teams.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
