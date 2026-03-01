"use client";
import { useState } from "react";

export default function RulesModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition shadow-lg"
      >
        View Scoring Rules
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-full p-6 relative my-8">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
            >
              &times;
            </button>

            <h2 className="text-2xl font-bold text-white mb-6">
              Rules and Methodology
            </h2>

            <div className="space-y-6 text-gray-300 text-sm max-h-[70vh] overflow-y-auto pr-2">
              {/* Core Team Sports */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  Standard Team Sports (NBA, NFL, MLB, NHL)
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> Final Win
                  Percentage * 400.
                </p>
                <p>
                  <strong>Postseason (600 pts max):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Make Playoffs: +60 pts.</li>
                  <li>Advance to Round 2 / Divisional: +90 pts.</li>
                  <li>Conference Finals / LCS: +120 pts.</li>
                  <li>Finals / Super Bowl / World Series: +150 pts.</li>
                  <li>Win Championship: +180 pts.</li>
                  <li className="text-gray-400 italic">
                    Note: Top seeds with Byes automatically earn the points for
                    the rounds they skip. Play-in teams (like NBA) earn +30 for
                    entry, and +30 for surviving to the 16-team field.
                  </li>
                </ul>
              </div>

              {/* WNBA */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  WNBA
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> Final Win
                  Percentage * 400.
                </p>
                <p>
                  <strong>Postseason (600 pts max):</strong> Make Playoffs (+90)
                  &rarr; Semifinals (+130) &rarr; Finals (+170) &rarr; Win
                  Championship (+210).
                </p>
              </div>

              {/* Tennis */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  Tennis (ATP & WTA)
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> (Your
                  Player&apos;s Pts / #1 Tour Point-getter&apos;s Pts) * 400.
                </p>
                <p>
                  <strong>Majors (4 per year):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>
                    Reach Rd. of 32 (+3.6), Rd of 16 (+7.1), QF (+14.3), SF
                    (+28.6), Final (+39.2), Win Final (+57.2).
                  </li>
                </ul>
              </div>

              {/* Golf */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  Golf (PGA & LPGA)
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> (Your
                  Golfer&apos;s Tour Pts / #1 Tour Point-getter&apos;s Pts) *
                  400.
                </p>
                <p>
                  <strong>PGA Majors (4 per year):</strong> Make the Cut (+15),
                  Top 10 (+30), Top 5 (+45), Win Major (+60).
                </p>
                <p>
                  <strong>LPGA Majors (5 per year):</strong> Make the Cut (+12),
                  Top 10 (+24)... etc.
                </p>
              </div>

              {/* College Basketball (Men's & Women's) */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  College Basketball (D-1)
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> Final Win
                  Percentage * 400.
                </p>
                <p>
                  <strong>March Madness (600 pts max):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Round of 64: +20 pts</li>
                  <li>Round of 32: +40 pts</li>
                  <li>Sweet 16: +60 pts</li>
                  <li>Elite 8: +80 pts</li>
                  <li>Final Four: +110 pts</li>
                  <li>Title Game: +130 pts</li>
                  <li>National Champion: +100 pts</li>
                  <li className="text-gray-400 italic">
                    Note: Teams that make the First Four Round will receive 10
                    points for making the field, and receive the 10 additional
                    points for making the Round of 64 if they advance.
                  </li>
                </ul>
              </div>

              {/* College Football */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  College Football (FBS)
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> Final Win
                  Percentage * 400.
                </p>
                <p>
                  <strong>CFP Postseason (600 pts max):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Make 12-Team CFP: +50 pts</li>
                  <li>Advance to Quarterfinals: +75 pts</li>
                  <li>Advance to Semifinals: +100 pts</li>
                  <li>Advance to National Championship: +150 pts</li>
                  <li>Win National Championship: +225 pts</li>
                  <li className="text-gray-400 italic">
                    Note: Top teams receiving a first-round bye automatically
                    earn the first 125 pts.
                  </li>
                </ul>
              </div>

              {/* MLS (Men's) */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  MLS
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> Final Win
                  Percentage * 400.
                </p>
                <p>
                  <strong>MLS Cup Playoffs (600 pts max):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Make Playoffs: +60 pts</li>
                  <li>Advance to Rd 2: +90 pts</li>
                  <li>Conf. Finals: +120 pts</li>
                  <li>MLS Cup Finals: +150 pts</li>
                  <li>Win Championship: +180 pts</li>
                </ul>
              </div>

              {/* Premier League (Men's) */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  Premier League
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> (Table Pts /
                  114) * 400.
                </p>
                <p>
                  <strong>Cups & European Play (600 pts max):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>
                    <strong>UCL:</strong> Advance to Knockouts (+20), QF (+35),
                    SF (+55), Finals (+80), Win (+105)
                  </li>
                  <li>
                    <strong>FA Cup:</strong> QF (+20), SF (+35), Final (+55),
                    Win (+80)
                  </li>
                  <li>
                    <strong>Carabao Cup:</strong> QF (+10), SF (+20), Finals
                    (+35), Champion (+50)
                  </li>
                  <li className="text-gray-400 italic">
                    Note: Europa League earns 66% of UCL points; Conference
                    League earns 33%.
                  </li>
                </ul>
              </div>

              {/* LOVB Volleyball */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  LOVB Volleyball
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> Final Win
                  Percentage * 400.
                </p>
                <p>
                  <strong>Postseason (600 pts max):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Make Playoffs / Semifinals: +100 pts</li>
                  <li>Advance to Finals: +200 pts</li>
                  <li>Win Championship: +300 pts</li>
                </ul>
              </div>

              {/* Formula 1 */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  Formula 1
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> (Your
                  Driver&apos;s non-Crown-Jewel WDC Pts / #1 Driver&apos;s
                  non-Crown-Jewel WDC Pts) * 400.
                </p>
                <p>
                  <strong>Crown Jewel Races (x4) (600 pts max):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Points Finish: +15 pts</li>
                  <li>Top 5 Finish: +30 pts</li>
                  <li>Podium Finish: +45 pts</li>
                  <li>Win Race: +60 pts</li>
                </ul>
              </div>

              {/* MMA (UFC) */}
              <div>
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-1 mb-2">
                  MMA
                </h3>
                <p>
                  <strong>Regular Season (400 pts max):</strong> 200 Points Per
                  Win (Requires 2 wins to max out at 400).
                </p>
                <p>
                  <strong>High-Leverage Events (Capped at 600 max):</strong>
                </p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Main Event Bout: +100 pts</li>
                  <li>Win vs. Top-5 Opponent: +150 pts</li>
                  <li>Win Title Fight: +350 pts</li>
                </ul>
              </div>

              {/* Dynasty Rule */}
              <div>
                <h3 className="text-lg font-bold text-green-400 border-b border-gray-700 pb-1 mb-2">
                  The Dynasty Rule (Offseason)
                </h3>
                <p>
                  Full portfolios are drafted in mid-February. Players/teams can
                  be dropped to free agency during the draft. In the month prior
                  to a sport season&apos;s start, a manager can replace their
                  team or player with available free agents. We will go in
                  reverse order of the standings for the draft.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
