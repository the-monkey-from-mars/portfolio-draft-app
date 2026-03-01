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

            <div className="space-y-4 text-gray-300 text-sm max-h-[75vh] overflow-y-auto pr-2">
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
                  2. Creating the New Contest Year
                </h3>
                <p>
                  Before drafting, go to the Supabase SQL Editor and insert a
                  new portfolio class: <br />
                  <code className="text-xs bg-black p-1 rounded mt-1 block text-green-400">
                    INSERT INTO portfolios (name) VALUES (&apos;Class of
                    27-28&apos;);
                  </code>
                </p>
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
                  5. MMA (UFC) & LOVB Manual Data
                </h3>
                <p>
                  Because free APIs rarely provide metadata like &quot;Title
                  Fights&quot; or &quot;Top 5 Opponents,&quot; MMA cannot be
                  fully automated through ESPN. When you are ready, you will
                  need to create a dedicated Supabase table to manually log
                  fight results and LOVB standings, and point your backend
                  scripts to read from those tables.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
