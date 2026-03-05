"use client";
import { useState } from "react";

export default function WaiverRulesModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-gray-800 hover:bg-gray-700 text-yellow-500 font-bold py-2 px-4 rounded transition border border-yellow-600/50"
      >
        Waiver Wire Rules
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-lg max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
            >
              &times;
            </button>

            <h2 className="text-3xl font-bold mb-6 text-yellow-500 border-b border-gray-700 pb-2">
              Dynasty Waiver Wire
            </h2>

            <div className="space-y-6 text-gray-300">
              <section>
                <h3 className="text-xl font-bold text-white mb-2">
                  1. The Timeline
                </h3>
                <p className="text-sm leading-relaxed">
                  There is <strong>no open free agency</strong> during the
                  season. Instead, each sport has a strict Waiver Deadline that
                  locks roughly one week before its regular season begins. You
                  may submit secret Drop/Add claims at any time before that
                  deadline strikes.
                </p>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-2">
                  2. Submitting Secret Claims
                </h3>
                <p className="text-sm leading-relaxed mb-2">
                  Navigate to your secure <strong>Manager Office</strong> using
                  your 4-digit PIN. Here, you can secretly queue up transactions
                  (e.g., Drop Texas ➡️ Add Nebraska). Nobody else in the league
                  can see your pending claims.
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-gray-400">
                  <li>
                    You <strong>must</strong> drop a team to add a team. There
                    are no empty roster slots.
                  </li>
                  <li>
                    Dropped teams immediately become locked Free Agents until
                    the main February Rollover Draft.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-2">
                  3. Contingency Planning
                </h3>
                <p className="text-sm leading-relaxed">
                  Because claims are secret, you might target the same team as
                  someone else. You can submit{" "}
                  <strong>multiple contingent claims</strong> for the same sport
                  and rank them in your Mission Control panel (Preference 1,
                  Preference 2, etc.). If your top target gets taken by a
                  manager with higher priority, the system will automatically
                  try your backup plan without losing your spot in line.
                </p>
              </section>

              <section>
                <h3 className="text-xl font-bold text-white mb-2">
                  4. Rolling Priority
                </h3>
                <p className="text-sm leading-relaxed mb-2">
                  When the deadline strikes at midnight, the Commissioner Bot
                  processes all secret claims based on Waiver Priority (1 being
                  the highest).
                </p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-gray-400">
                  <li>
                    If your claim is successful, you instantly drop to the
                    absolute <strong>bottom</strong> of the priority list.
                  </li>
                  <li>
                    The bot immediately re-sorts the list and continues
                    processing.
                  </li>
                  <li>
                    Waiver priority does <em>not</em> reset after a sport&apos;s
                    deadline. It rolls over from sport to sport all year until
                    the February Draft.
                  </li>
                </ul>
              </section>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
