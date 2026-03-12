"use client";
import { useState } from "react";

const DRAFT_RESULTS = [
  { round: 1, pick: 1, manager: "Johnny", selection: "Carlos Alcaraz" },
  { round: 1, pick: 2, manager: "Walker", selection: "Aryna Sabalenka" },
  { round: 1, pick: 3, manager: "CJ", selection: "Max Verstappen" },
  { round: 1, pick: 4, manager: "Matt", selection: "Jannik Sinner" },
  { round: 1, pick: 5, manager: "Chad", selection: "Atthaya Thitikul" },
  { round: 2, pick: 6, manager: "Chad", selection: "Scottie Scheffler" },
  { round: 2, pick: 7, manager: "Matt", selection: "George Russell" },
  { round: 2, pick: 8, manager: "CJ", selection: "Lando Norris" },
  { round: 2, pick: 9, manager: "Walker", selection: "LA Dodgers" },
  { round: 2, pick: 10, manager: "Johnny", selection: "Arsenal" },
  { round: 3, pick: 11, manager: "Johnny", selection: "Inter Miami" },
  { round: 3, pick: 12, manager: "Walker", selection: "Las Vegas Aces" },
  { round: 3, pick: 13, manager: "CJ", selection: "Seattle Mariners" },
  { round: 3, pick: 14, manager: "Matt", selection: "Duke (Men's CBB)" },
  { round: 3, pick: 15, manager: "Chad", selection: "UConn (Women's CBB)" },
  { round: 4, pick: 16, manager: "Chad", selection: "Elena Rybakina" },
  {
    round: 4,
    pick: 17,
    manager: "Matt",
    selection: "South Carolina (Women's CBB)",
  },
  { round: 4, pick: 18, manager: "CJ", selection: "Minnesota Lynx" },
  { round: 4, pick: 19, manager: "Walker", selection: "Alexander Zverev" },
  { round: 4, pick: 20, manager: "Johnny", selection: "Coco Gauff" },
  { round: 5, pick: 21, manager: "Johnny", selection: "Nelly Korda" },
  { round: 5, pick: 22, manager: "Walker", selection: "Colorado Avalanche" },
  { round: 5, pick: 23, manager: "CJ", selection: "LAFC" },
  { round: 5, pick: 24, manager: "Matt", selection: "Indiana Fever" },
  { round: 5, pick: 25, manager: "Chad", selection: "Manchester City" },
  { round: 6, pick: 26, manager: "Chad", selection: "Islam Makhachev" },
  { round: 6, pick: 27, manager: "Matt", selection: "San Antonio Spurs" },
  { round: 6, pick: 28, manager: "CJ", selection: "New York Liberty" },
  { round: 6, pick: 29, manager: "Walker", selection: "Lewis Hamilton" },
  { round: 6, pick: 30, manager: "Johnny", selection: "Charles Leclerc" },
  { round: 7, pick: 31, manager: "Johnny", selection: "Boston Celtics" },
  { round: 7, pick: 32, manager: "Walker", selection: "Ohio State (CFB)" },
  { round: 7, pick: 33, manager: "CJ", selection: "Vancouver Whitecaps" },
  { round: 7, pick: 34, manager: "Matt", selection: "Atlanta Braves" },
  { round: 7, pick: 35, manager: "Chad", selection: "Philadelphia Eagles" },
  { round: 8, pick: 36, manager: "Chad", selection: "Tampa Bay Lightning" },
  { round: 8, pick: 37, manager: "Matt", selection: "Oscar Piastri" },
  { round: 8, pick: 38, manager: "CJ", selection: "Liverpool" },
  { round: 8, pick: 39, manager: "Walker", selection: "Oklahoma City Thunder" },
  { round: 8, pick: 40, manager: "Johnny", selection: "Rory McIlroy" },
  { round: 9, pick: 41, manager: "Johnny", selection: "Texas (Women's CBB)" },
  { round: 9, pick: 42, manager: "Walker", selection: "Manchester United" },
  { round: 9, pick: 43, manager: "CJ", selection: "Oregon (CFB)" },
  { round: 9, pick: 44, manager: "Matt", selection: "San Diego FC" },
  { round: 9, pick: 45, manager: "Chad", selection: "Texas (CFB)" },
  { round: 10, pick: 46, manager: "Chad", selection: "Los Angeles Lakers" },
  { round: 10, pick: 47, manager: "Matt", selection: "Boston Bruins" },
  { round: 10, pick: 48, manager: "CJ", selection: "Xander Schauffele" },
  { round: 10, pick: 49, manager: "Walker", selection: "Aston Villa" },
  { round: 10, pick: 50, manager: "Johnny", selection: "Chizzy Iwai" },
  { round: 11, pick: 51, manager: "Johnny", selection: "Kimi Antonelli" },
  { round: 11, pick: 52, manager: "Walker", selection: "Iga Swiatek" },
  { round: 11, pick: 53, manager: "CJ", selection: "Amanda Anisimova" },
  { round: 11, pick: 54, manager: "Matt", selection: "Chelsea" },
  { round: 11, pick: 55, manager: "Chad", selection: "New York Mets" },
  { round: 12, pick: 56, manager: "Chad", selection: "New York Yankees" },
  { round: 12, pick: 57, manager: "Matt", selection: "Collin Morikawa" },
  { round: 12, pick: 58, manager: "CJ", selection: "New England Patriots" },
  { round: 12, pick: 59, manager: "Walker", selection: "Toronto Blue Jays" },
  { round: 12, pick: 60, manager: "Johnny", selection: "Lorenzo Musetti" },
  { round: 13, pick: 61, manager: "Johnny", selection: "Khamzat Chimaev" },
  { round: 13, pick: 62, manager: "Walker", selection: "Atlanta Dream" },
  { round: 13, pick: 63, manager: "CJ", selection: "Boston Red Sox" },
  { round: 13, pick: 64, manager: "Matt", selection: "UConn (Men's CBB)" },
  { round: 13, pick: 65, manager: "Chad", selection: "Ben Shelton" },
  { round: 14, pick: 66, manager: "Chad", selection: "Taylor Fritz" },
  { round: 14, pick: 67, manager: "Matt", selection: "Notre Dame (CFB)" },
  { round: 14, pick: 68, manager: "CJ", selection: "Arizona (Men's CBB)" },
  { round: 14, pick: 69, manager: "Walker", selection: "Carolina Hurricanes" },
  { round: 14, pick: 70, manager: "Johnny", selection: "Jasmine Paolini" },
  { round: 15, pick: 71, manager: "Johnny", selection: "Georgia (CFB)" },
  { round: 15, pick: 72, manager: "Walker", selection: "New York Knicks" },
  { round: 15, pick: 73, manager: "CJ", selection: "Ilia Topuria" },
  { round: 15, pick: 74, manager: "Matt", selection: "Joshua Van" },
  { round: 15, pick: 75, manager: "Chad", selection: "Lydia Ko" },
  { round: 16, pick: 76, manager: "Chad", selection: "Tommy Fleetwood" },
  { round: 16, pick: 77, manager: "Matt", selection: "Mirra Andreeva" },
  { round: 16, pick: 78, manager: "CJ", selection: "Alex Pereira" },
  { round: 16, pick: 79, manager: "Walker", selection: "Seattle Seahawks" },
  {
    round: 16,
    pick: 80,
    manager: "Johnny",
    selection: "Alexander Volkanovski",
  },
  { round: 17, pick: 81, manager: "Johnny", selection: "Alabama (CFB)" },
  { round: 17, pick: 82, manager: "Walker", selection: "Nashville SC" },
  { round: 17, pick: 83, manager: "CJ", selection: "Penn State (CFB)" },
  { round: 17, pick: 84, manager: "Matt", selection: "Buffalo Bills" },
  { round: 17, pick: 85, manager: "Chad", selection: "Cincinnati Bengals" },
  { round: 18, pick: 86, manager: "Chad", selection: "Texas Tech (CFB)" },
  { round: 18, pick: 87, manager: "Matt", selection: "Houston Astros" },
  { round: 18, pick: 88, manager: "CJ", selection: "Penn State (WVB)" },
  { round: 18, pick: 89, manager: "Walker", selection: "Denver Broncos" },
  { round: 18, pick: 90, manager: "Johnny", selection: "Nebraska (WVB)" },
  { round: 19, pick: 91, manager: "Johnny", selection: "Edmonton Oilers" },
  { round: 19, pick: 92, manager: "Walker", selection: "Texas (WVB)" },
  { round: 19, pick: 93, manager: "CJ", selection: "Stanford (WVB)" },
  { round: 19, pick: 94, manager: "Matt", selection: "Wisconsin (WVB)" },
  { round: 19, pick: 95, manager: "Chad", selection: "Cleveland Cavaliers" },
  { round: 20, pick: 96, manager: "Chad", selection: "Kansas (Men's CBB)" },
  { round: 20, pick: 97, manager: "Matt", selection: "Charlotte Hornets" },
  { round: 20, pick: 98, manager: "CJ", selection: "Detroit Pistons" },
  { round: 20, pick: 99, manager: "Walker", selection: "UCLA (Women's CBB)" },
  { round: 20, pick: 100, manager: "Johnny", selection: "Kentucky (WVB)" },
  { round: 21, pick: 101, manager: "Johnny", selection: "Phoenix Mercury" },
  { round: 21, pick: 102, manager: "Walker", selection: "Indiana (CFB)" },
  { round: 21, pick: 103, manager: "CJ", selection: "Houston Texans" },
  { round: 21, pick: 104, manager: "Matt", selection: "Pittsburgh (WVB)" },
  { round: 21, pick: 105, manager: "Chad", selection: "Red Bull New York" },
  { round: 22, pick: 106, manager: "Chad", selection: "Minnesota Twins" },
  { round: 22, pick: 107, manager: "Matt", selection: "Minjee Lee" },
  { round: 22, pick: 108, manager: "CJ", selection: "Everton" },
  { round: 22, pick: 109, manager: "Walker", selection: "Louisville (WVB)" },
  { round: 22, pick: 110, manager: "Johnny", selection: "USC (Women's CBB)" },
  { round: 23, pick: 111, manager: "Johnny", selection: "Brentford" },
  { round: 23, pick: 112, manager: "Walker", selection: "Houston (Men's CBB)" },
  { round: 23, pick: 113, manager: "CJ", selection: "Minnesota Timberwolves" },
  { round: 23, pick: 114, manager: "Matt", selection: "San Jose Sharks" },
  {
    round: 23,
    pick: 115,
    manager: "Chad",
    selection: "Golden State Valkyries",
  },
  { round: 24, pick: 116, manager: "Chad", selection: "Washington Mystics" },
  { round: 24, pick: 117, manager: "Matt", selection: "Los Angeles Rams" },
  { round: 24, pick: 118, manager: "CJ", selection: "UNC (Men's CBB)" },
  { round: 24, pick: 119, manager: "Walker", selection: "Florida (Men's CBB)" },
  { round: 24, pick: 120, manager: "Johnny", selection: "Florida Panthers" },
  { round: 25, pick: 121, manager: "Johnny", selection: "Charlotte FC" },
  { round: 25, pick: 122, manager: "Walker", selection: "LSU (Women's CBB)" },
  { round: 25, pick: 123, manager: "CJ", selection: "Buffalo Sabres" },
  { round: 25, pick: 124, manager: "Matt", selection: "Michigan (CFB)" },
  { round: 25, pick: 125, manager: "Chad", selection: "Michigan (Men's CBB)" },
  { round: 26, pick: 126, manager: "Chad", selection: "Vegas Golden Knights" },
  { round: 26, pick: 127, manager: "Matt", selection: "Felix Auger-Aliassime" },
  { round: 26, pick: 128, manager: "CJ", selection: "Charley Hull" },
  { round: 26, pick: 129, manager: "Walker", selection: "Alex de Minaur" },
  { round: 26, pick: 130, manager: "Johnny", selection: "Viktor Hovland" },
  { round: 27, pick: 131, manager: "Johnny", selection: "Chicago Sky" },
  { round: 27, pick: 132, manager: "Walker", selection: "Justin Rose" },
  { round: 27, pick: 133, manager: "CJ", selection: "Michigan (Women's CBB)" },
  { round: 27, pick: 134, manager: "Matt", selection: "Miyu Yamashita" },
  { round: 27, pick: 135, manager: "Chad", selection: "Jessica Pegula" },
  {
    round: 28,
    pick: 136,
    manager: "Chad",
    selection: "Vanderbilt (Women's CBB)",
  },
  { round: 28, pick: 137, manager: "Matt", selection: "Victoria Mboko" },
  { round: 28, pick: 138, manager: "CJ", selection: "Dallas Stars" },
  { round: 28, pick: 139, manager: "Walker", selection: "Chris Gotterup" },
  { round: 28, pick: 140, manager: "Johnny", selection: "Gonzaga (Men's CBB)" },
  { round: 29, pick: 141, manager: "Johnny", selection: "Cleveland Guardians" },
  { round: 29, pick: 142, manager: "Walker", selection: "Isack Hadjar" },
  { round: 29, pick: 143, manager: "CJ", selection: "Oklahoma (Women's CBB)" },
  { round: 29, pick: 144, manager: "Matt", selection: "Petr Yan" },
  { round: 29, pick: 145, manager: "Chad", selection: "Tom Aspinall" },
  { round: 30, pick: 146, manager: "Chad", selection: "SMU (WVB)" },
  { round: 30, pick: 147, manager: "Matt", selection: "Ludvig Åberg" },
  { round: 30, pick: 148, manager: "CJ", selection: "Novak Djokovic" },
  { round: 30, pick: 149, manager: "Walker", selection: "Lottie Woad" },
  {
    round: 30,
    pick: 150,
    manager: "Johnny",
    selection: "Philadelphia Phillies",
  },
  {
    round: 31,
    pick: 151,
    manager: "Johnny",
    selection: "Arkansas (Men's CBB)",
  },
  {
    round: 31,
    pick: 152,
    manager: "Walker",
    selection: "Valentina Shevchenko",
  },
  { round: 31, pick: 153, manager: "CJ", selection: "Daniil Medvedev" },
  { round: 31, pick: 154, manager: "Matt", selection: "Los Angeles Sparks" },
  { round: 31, pick: 155, manager: "Chad", selection: "Newcastle United" },
  { round: 32, pick: 156, manager: "Chad", selection: "Minnesota (WVB)" },
  { round: 32, pick: 157, manager: "Matt", selection: "Crystal Palace" },
  { round: 32, pick: 158, manager: "CJ", selection: "Elina Svitolina" },
  { round: 32, pick: 159, manager: "Walker", selection: "Zhang Weili" },
  { round: 32, pick: 160, manager: "Johnny", selection: "Denver Nuggets" },
  { round: 33, pick: 161, manager: "Johnny", selection: "Baltimore Ravens" },
  { round: 33, pick: 162, manager: "Walker", selection: "Hyo Joo Kim" },
  { round: 33, pick: 163, manager: "CJ", selection: "Hannah Green" },
  { round: 33, pick: 164, manager: "Matt", selection: "Duke (Women's CBB)" },
  { round: 33, pick: 165, manager: "Chad", selection: "Carlos Sainz" },
  { round: 34, pick: 166, manager: "Chad", selection: "Fernando Alonso" },
  { round: 34, pick: 167, manager: "Matt", selection: "New York City FC" },
  { round: 34, pick: 168, manager: "CJ", selection: "Brooks Koepka" },
  {
    round: 34,
    pick: 169,
    manager: "Walker",
    selection: "San Jose Earthquakes",
  },
  { round: 34, pick: 170, manager: "Johnny", selection: "Detroit Lions" },
  { round: 35, pick: 171, manager: "Chad", selection: "France" },
  { round: 35, pick: 172, manager: "Matt", selection: "Spain" },
  { round: 35, pick: 173, manager: "CJ", selection: "Brazil" },
  { round: 35, pick: 174, manager: "Walker", selection: "Kansas City Current" },
  { round: 35, pick: 175, manager: "Johnny", selection: "Argentina" },
  { round: 36, pick: 176, manager: "Johnny", selection: "Washington Spirit" },
  { round: 36, pick: 177, manager: "Walker", selection: "Orlando Pride" },
  { round: 36, pick: 178, manager: "CJ", selection: "Gotham FC" },
  { round: 36, pick: 179, manager: "Matt", selection: "Portland Thorns" },
  { round: 36, pick: 180, manager: "Chad", selection: "Portugal" },
  { round: 37, pick: 181, manager: "Chad", selection: "Denver Summit FC" },
  { round: 37, pick: 182, manager: "Matt", selection: "Seattle Reign" },
  { round: 37, pick: 183, manager: "CJ", selection: "United States" },
  { round: 37, pick: 184, manager: "Walker", selection: "England" },
  { round: 37, pick: 185, manager: "Johnny", selection: "Germany" },
  {
    round: 38,
    pick: 186,
    manager: "Johnny",
    selection: "North Carolina Courage",
  },
  { round: 38, pick: 187, manager: "Walker", selection: "Netherlands" },
  { round: 38, pick: 188, manager: "CJ", selection: "Boston Legacy" },
  { round: 38, pick: 189, manager: "Matt", selection: "Belgium" },
  { round: 38, pick: 190, manager: "Chad", selection: "San Diego Wave" },
];

const MANAGER_COLORS = {
  Chad: {
    bg: "bg-red-900/30",
    text: "text-red-400",
    border: "border-red-800/40",
  },
  CJ: {
    bg: "bg-blue-900/30",
    text: "text-blue-400",
    border: "border-blue-800/40",
  },
  Matt: {
    bg: "bg-emerald-900/30",
    text: "text-emerald-400",
    border: "border-emerald-800/40",
  },
  Johnny: {
    bg: "bg-amber-900/30",
    text: "text-amber-400",
    border: "border-amber-800/40",
  },
  Walker: {
    bg: "bg-purple-900/30",
    text: "text-purple-400",
    border: "border-purple-800/40",
  },
};

const MANAGERS = ["Chad", "CJ", "Johnny", "Matt", "Walker"];

export default function DraftResultsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [filterManager, setFilterManager] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = DRAFT_RESULTS.filter((pick) => {
    if (filterManager !== "all" && pick.manager !== filterManager) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        pick.selection.toLowerCase().includes(q) ||
        pick.manager.toLowerCase().includes(q) ||
        String(pick.pick).includes(q)
      );
    }
    return true;
  });

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-yellow-500 hover:text-yellow-400 font-semibold tracking-wide transition underline decoration-yellow-600/50 underline-offset-2 hover:decoration-yellow-400"
      >
        Inaugural Draft: 03/01/2026
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full relative shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-gray-700 flex-shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
              >
                &times;
              </button>
              <h2 className="text-2xl font-bold text-white">
                Inaugural Draft Results
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                March 1, 2026 &middot; 34 Rounds &middot; 170 Picks &middot;
                Snake Draft
              </p>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 mt-4">
                <select
                  value={filterManager}
                  onChange={(e) => setFilterManager(e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Managers</option>
                  {MANAGERS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Search pick, team, or manager..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded px-3 py-1.5 flex-grow min-w-[180px] focus:outline-none focus:border-blue-500"
                />

                <span className="text-gray-500 text-sm self-center">
                  {filtered.length} pick{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-grow px-6 pb-4">
              <table className="w-full text-sm mt-3">
                <thead className="sticky top-0 bg-gray-900 z-10">
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="py-2 pr-3 w-16">Round</th>
                    <th className="py-2 pr-3 w-16">Pick</th>
                    <th className="py-2 pr-3 w-28">Manager</th>
                    <th className="py-2">Selection</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((pick) => {
                    const colors = MANAGER_COLORS[pick.manager] || {
                      bg: "",
                      text: "text-gray-300",
                      border: "",
                    };
                    const isNewRound =
                      pick === filtered[0] ||
                      pick.round !==
                        filtered[filtered.indexOf(pick) - 1]?.round;

                    return (
                      <tr
                        key={pick.pick}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition ${
                          isNewRound && filterManager === "all"
                            ? "border-t border-t-gray-600"
                            : ""
                        }`}
                      >
                        <td className="py-2.5 pr-3 text-gray-500 font-mono text-xs">
                          {pick.round}
                        </td>
                        <td className="py-2.5 pr-3 text-gray-400 font-mono font-bold">
                          {pick.pick}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${colors.bg} ${colors.text} border ${colors.border}`}
                          >
                            {pick.manager}
                          </span>
                        </td>
                        <td className="py-2.5 text-white font-medium">
                          {pick.selection}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-700 flex-shrink-0 flex justify-between items-center">
              <div className="flex gap-3">
                {MANAGERS.map((m) => {
                  const colors = MANAGER_COLORS[m];
                  const count = DRAFT_RESULTS.filter(
                    (p) => p.manager === m,
                  ).length;
                  return (
                    <button
                      key={m}
                      onClick={() =>
                        setFilterManager(filterManager === m ? "all" : m)
                      }
                      className={`text-xs px-2 py-1 rounded border transition ${
                        filterManager === m
                          ? `${colors.bg} ${colors.text} ${colors.border}`
                          : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {m} ({count})
                    </button>
                  );
                })}
              </div>
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
