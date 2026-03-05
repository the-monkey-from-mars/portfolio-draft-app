"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { SPORT_CONFIG } from "../../lib/sportConfig";
import AdminHelpModal from "../../components/AdminHelpModal";
import AdminScoreOverride from "../../components/AdminScoreOverride";
import AdminRosterManager from "../../components/AdminRosterManager";

export default function AdminDashboard() {
  // --- NEW AUTHENTICATION STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [showReminder, setShowReminder] = useState(false);
  const [loginError, setLoginError] = useState(false);

  // State to hold our database lists
  const [users, setUsers] = useState([]);
  const [sports, setSports] = useState([]);
  const [entities, setEntities] = useState([]);

  // State to hold what the admin currently has selected
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // 1. Fetch Users and Sports when the page loads
  useEffect(() => {
    // We only need to fetch data if they successfully log in!
    if (!isAuthenticated) return;

    async function loadInitialData() {
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("is_active", true);
      const { data: sportData } = await supabase.from("sports").select("*");

      // Sort sports chronologically
      const sortedSports = (sportData || []).sort((a, b) => {
        const orderA = SPORT_CONFIG[a.id]?.order || 99;
        const orderB = SPORT_CONFIG[b.id]?.order || 99;
        return orderA - orderB;
      });

      setUsers(userData || []);
      setSports(sortedSports);
    }
    loadInitialData();
  }, [isAuthenticated]);

  // 2. Fetch Teams (Entities) ONLY when a specific Sport is selected
  useEffect(() => {
    async function loadEntities() {
      if (!selectedSport) {
        setEntities([]);
        return;
      }
      const { data: entityData } = await supabase
        .from("entities")
        .select("*")
        .eq("sport_id", selectedSport)
        .order("display_name");

      setEntities(entityData || []);
    }
    loadEntities();
  }, [selectedSport]);

  // --- LOGIN HANDLER ---
  const handleLogin = (e) => {
    e.preventDefault(); // Prevent page refresh on submit
    if (passwordInput === "randymoss81") {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setPasswordInput("");
    }
  };

  // 3. The function that saves the pick to the database
  const handleSavePick = async () => {
    if (!selectedUser || !selectedSport || !selectedEntity) {
      setStatusMessage("⚠️ Please select a User, Sport, and Team.");
      return;
    }

    setStatusMessage("Saving...");

    // STEP A: Find the first EMPTY slot for this user and sport
    const { data: availableSlots, error: fetchError } = await supabase
      .from("roster_picks")
      .select("id")
      .eq("user_id", selectedUser)
      .eq("sport_id", selectedSport)
      .is("entity_id", null) // Only look for slots that haven't been drafted yet
      .order("id", { ascending: true })
      .limit(1);

    if (fetchError) {
      console.error(fetchError);
      setStatusMessage("❌ Error checking available slots.");
      return;
    }

    // If both slots are already filled, stop them from drafting a third!
    if (availableSlots.length === 0) {
      setStatusMessage(
        "⚠️ This user already has all slots filled for this sport!",
      );
      return;
    }

    const targetSlotId = availableSlots[0].id;

    // STEP B: Update ONLY that specific slot
    const { error: updateError } = await supabase
      .from("roster_picks")
      .update({ entity_id: selectedEntity })
      .eq("id", targetSlotId);

    if (updateError) {
      console.error(updateError);
      setStatusMessage("❌ Error saving draft pick!");
    } else {
      setStatusMessage("✅ Draft pick successfully locked in!");
      setSelectedEntity(""); // Reset the team dropdown for the next pick
    }
  };

  // --- TOGGLE SPORT SCRAPING STATUS ---
  const toggleScraping = async (sportId, currentStatus) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from("sports")
      .update({ is_scraping_active: newStatus })
      .eq("id", sportId);

    if (error) {
      console.error(error);
      setStatusMessage("❌ Error updating sport status.");
    } else {
      // Update the UI instantly without reloading the page
      setSports(
        sports.map((s) =>
          s.id === sportId ? { ...s, is_scraping_active: newStatus } : s,
        ),
      );
    }
  };

  // --- SMARTER SEEDING FUNCTIONS (NO DUPLICATES) ---
  const seedESPNLeague = async (sportId, apiUrl) => {
    setStatusMessage(`Fetching data from ESPN...`);
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      let teams = [];

      if (data?.sports?.[0]?.leagues?.[0]?.teams) {
        teams = data.sports[0].leagues[0].teams;
      }
      if (data?.sports?.[0]?.leagues?.[0]?.groups) {
        data.sports[0].leagues[0].groups.forEach((group) => {
          if (group.teams) {
            teams = teams.concat(group.teams);
          }
        });
      }

      if (teams.length === 0) {
        setStatusMessage(`❌ Error: Could not find teams in the API response.`);
        return;
      }

      const entitiesToInsert = teams.map((t) => {
        const teamData = t.team ? t.team : t;
        return {
          sport_id: sportId,
          api_unique_id: teamData.id.toString(),
          display_name: teamData.displayName,
        };
      });

      // 1. Fetch existing teams to prevent duplicates
      const { data: existing } = await supabase
        .from("entities")
        .select("api_unique_id")
        .eq("sport_id", sportId);

      const existingIds = new Set(existing?.map((e) => e.api_unique_id) || []);
      const newEntities = entitiesToInsert.filter(
        (e) => !existingIds.has(e.api_unique_id),
      );

      if (newEntities.length === 0) {
        setStatusMessage(
          `✅ All teams are already synced! No duplicates added.`,
        );
        return;
      }

      // 2. Insert ONLY the new teams
      const { error } = await supabase.from("entities").insert(newEntities);

      if (error) {
        console.error(error);
        setStatusMessage(`❌ Error saving teams to database.`);
      } else {
        setStatusMessage(
          `✅ Successfully seeded ${newEntities.length} NEW teams!`,
        );
        if (selectedSport == sportId) setSelectedSport("");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(`❌ Failed to fetch from ESPN.`);
    }
  };

  const seedManualLeague = async (sportId, teamsArray) => {
    setStatusMessage(`Checking manual data...`);

    const entitiesToInsert = teamsArray.map((name) => {
      // Create a clean "slug" from the name (e.g., "Joshua Van" -> "joshua-van")
      const nameSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "-");

      return {
        sport_id: sportId,
        api_unique_id: `manual_${sportId}_${nameSlug}`, // ID is now name-based!
        display_name: name,
      };
    });

    const { data: existing } = await supabase
      .from("entities")
      .select("api_unique_id")
      .eq("sport_id", sportId);

    const existingIds = new Set(existing?.map((e) => e.api_unique_id) || []);
    const newEntities = entitiesToInsert.filter(
      (e) => !existingIds.has(e.api_unique_id),
    );

    if (newEntities.length === 0) {
      setStatusMessage(`✅ All manual entries are already synced!`);
      return;
    }

    const { error } = await supabase.from("entities").insert(newEntities);

    if (error) {
      console.error(error);
      setStatusMessage(`❌ Error saving manual entries.`);
    } else {
      setStatusMessage(
        `✅ Successfully seeded ${newEntities.length} NEW entries!`,
      );
      if (selectedSport == sportId) setSelectedSport("");
    }
  };

  const seedESPNAthletes = async (sportId, apiUrl) => {
    setStatusMessage(`Fetching athletes from ESPN...`);
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      let athletes = [];

      if (data?.sports?.[0]?.leagues?.[0]?.athletes) {
        athletes = data.sports[0].leagues[0].athletes;
      } else if (data?.athletes) {
        athletes = data.athletes;
      }

      if (athletes.length === 0) {
        setStatusMessage(
          `❌ Error: Could not find athletes in the API response.`,
        );
        return;
      }

      const entitiesToInsert = athletes.map((a) => {
        const athleteData = a.athlete ? a.athlete : a;
        return {
          sport_id: sportId,
          api_unique_id: athleteData.id.toString(),
          display_name: athleteData.displayName,
        };
      });

      const { data: existing } = await supabase
        .from("entities")
        .select("api_unique_id")
        .eq("sport_id", sportId);

      const existingIds = new Set(existing?.map((e) => e.api_unique_id) || []);
      const newEntities = entitiesToInsert.filter(
        (e) => !existingIds.has(e.api_unique_id),
      );

      if (newEntities.length === 0) {
        setStatusMessage(`✅ All athletes are already synced!`);
        return;
      }

      const { error } = await supabase.from("entities").insert(newEntities);

      if (error) {
        console.error(error);
        setStatusMessage(`❌ Error saving athletes to database.`);
      } else {
        setStatusMessage(
          `✅ Successfully seeded ${newEntities.length} NEW athletes!`,
        );
        if (selectedSport == sportId) setSelectedSport("");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage(`❌ Failed to fetch athletes from ESPN.`);
    }
  };

  // --- SECURITY GATE: RENDER LOGIN SCREEN IF NOT AUTHENTICATED ---
  if (!isAuthenticated) {
    return (
      <main className="p-10 text-white max-w-md mx-auto mt-20 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-400">
          Admin Access
        </h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="password"
              placeholder="Enter Admin Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full p-3 rounded bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          {loginError && (
            <p className="text-red-500 text-sm font-bold text-center">
              Incorrect password. Nice try, hacker.
            </p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition"
          >
            Enter Draft Room
          </button>
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setShowReminder(!showReminder)}
              className="text-sm text-gray-400 hover:text-white transition underline"
            >
              Forgot Password?
            </button>
            {showReminder && (
              <p className="mt-4 text-yellow-400 font-bold bg-gray-800 p-3 rounded border border-yellow-600">
                Reminder: Goat receiver lower case
              </p>
            )}
          </div>
        </form>
        <div className="mt-8 text-center border-t border-gray-700 pt-6">
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm transition"
          >
            &larr; Back to Leaderboard
          </Link>
        </div>
      </main>
    );
  }

  // --- THE ACTUAL ADMIN DASHBOARD (ONLY RENDERED IF AUTHENTICATED) ---
  return (
    <main className="p-10 text-white max-w-2xl mx-auto">
      <Link
        href="/"
        className="text-blue-400 hover:underline mb-6 inline-block"
      >
        &larr; Back to Leaderboard
      </Link>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Draft Room</h1>
          <p className="text-gray-400">
            Manually lock in roster picks from the group chat.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AdminHelpModal />
          <AdminScoreOverride />
          <AdminRosterManager />
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded shadow-lg space-y-6">
        <div>
          <label className="block text-sm font-bold mb-2">
            1. Select League Member
          </label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Choose a Manager --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">
            2. Select Sport
          </label>
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500"
            disabled={!selectedUser}
          >
            <option value="">-- Choose a Sport --</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">
            3. Draft the Team / Athlete
          </label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500"
            disabled={!selectedSport}
          >
            <option value="">-- Choose Team/Athlete --</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.display_name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSavePick}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded transition"
        >
          Lock In Pick
        </button>

        {statusMessage && (
          <p className="text-center font-bold mt-4 text-yellow-400">
            {statusMessage}
          </p>
        )}
      </div>

      {/* --- SEASON LOCK TOGGLES --- */}
      <div className="mt-12 bg-gray-900 border border-gray-700 p-6 rounded shadow-lg">
        <h2 className="text-xl font-bold mb-2 text-white">
          Season Locks (Cron Toggles)
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Turn scraping ON when a season begins, and OFF when it ends to lock in
          the final scores.
        </p>
        <div className="space-y-3">
          {sports.map((s) => (
            <div
              key={s.id}
              className="flex justify-between items-center bg-gray-800 p-3 rounded border border-gray-700"
            >
              <span className="font-bold text-gray-200">{s.name}</span>
              <button
                onClick={() => toggleScraping(s.id, s.is_scraping_active)}
                className={`px-4 py-2 rounded font-bold text-sm transition ${
                  s.is_scraping_active
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-red-600 hover:bg-red-500 text-white"
                }`}
              >
                {s.is_scraping_active ? "🟢 ON (Active)" : "🔴 OFF (Locked)"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* --- TEMPORARY DATA SEEDING DASHBOARD --- */}
      <div className="mt-12 bg-gray-900 border border-gray-700 p-6 rounded shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-red-400">
          Database Setup (Admin Only)
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Click these once to populate your team dictionary.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() =>
              seedESPNLeague(
                1,
                "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=50",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync NBA Teams
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                2,
                "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams?limit=50",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync WNBA Teams
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                3,
                "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=50",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync NFL Teams
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                4,
                "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams?limit=50",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync MLB Teams
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                5,
                "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams?limit=50",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync NHL Teams
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                9,
                "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?groups=80&groupType=conference&enable=groups",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync College Football (FBS)
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                10,
                "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=400",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync Men&apos;s CBB (D-1)
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                11,
                "https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams?groups=50&limit=400",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync Women&apos;s CBB (D-1)
          </button>
          <button
            onClick={() =>
              seedESPNLeague(
                6,
                "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/teams?limit=50",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync MLS Teams
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                8,
                "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams?limit=50",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync Premier League
          </button>

          <button
            onClick={() =>
              seedESPNLeague(
                7,
                "https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/teams?groups=50&limit=400",
              )
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync Women&apos;s College Volleyball
          </button>

          <button
            onClick={() =>
              seedManualLeague(16, [
                "Max Verstappen",
                "Lando Norris",
                "Charles Leclerc",
                "Oscar Piastri",
                "Carlos Sainz",
                "George Russell",
                "Lewis Hamilton",
                "Fernando Alonso",
                "Yuki Tsunoda",
                "Lance Stroll",
                "Alexander Albon",
                "Pierre Gasly",
                "Esteban Ocon",
                "Nico Hulkenberg",
                "Valtteri Bottas",
                "Zhou Guanyu",
                "Kevin Magnussen",
                "Franco Colapinto",
                "Liam Lawson",
                "Oliver Bearman",
                "Jack Doohan",
                "Andrea Kimi Antonelli",
                "Gabriel Bortoleto",
                "Isack Hadjar",
              ])
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync F1 Drivers
          </button>
          <button
            onClick={() =>
              seedManualLeague(12, [
                "Jannik Sinner",
                "Carlos Alcaraz",
                "Novak Djokovic",
                "Daniil Medvedev",
                "Alexander Zverev",
                "Andrey Rublev",
                "Casper Ruud",
                "Hubert Hurkacz",
                "Alex de Minaur",
                "Stefanos Tsitsipas",
                "Taylor Fritz",
                "Tommy Paul",
                "Ben Shelton",
                "Grigor Dimitrov",
                "Holger Rune",
                "Frances Tiafoe",
                "Sebastian Korda",
                "Sebastian Baez",
                "Alexander Bublik",
                "Adrian Mannarino",
                "Ugo Humbert",
                "Nicolas Jarry",
                "Lorenzo Musetti",
                "Francisco Cerundolo",
                "Tallon Griekspoor",
                "Cameron Norrie",
                "Tomas Martin Etcheverry",
                "Jiri Lehecka",
                "Felix Auger-Aliassime",
                "Karen Khachanov",
                "Matteo Arnaldi",
                "Flavio Cobolli",
                "Tomas Machac",
                "Alexei Popyrin",
                "Arthur Fils",
                "Jack Draper",
                "Jan-Lennard Struff",
                "Jordan Thompson",
                "Mariano Navone",
                "Luciano Darderi",
                "Alejandro Tabilo",
                "Sebastian Ofner",
                "Roman Safiullin",
                "Fabian Marozsan",
                "Marcos Giron",
                "Pedro Martinez",
                "Yoshihito Nishioka",
                "Miomir Kecmanovic",
                "Aslan Karatsev",
                "Nuno Borges",
                "Christopher O'Connell",
                "Aleksandar Vukic",
                "Thiago Seyboth Wild",
                "Alex Michelsen",
                "Jakub Mensik",
                "Brandon Nakashima",
                "Juncheng Shang",
                "Borna Coric",
                "Roberto Bautista Agut",
                "Daniel Evans",
                "Matteo Berrettini",
                "Stan Wawrinka",
                "David Goffin",
                "Gael Monfils",
                "Richard Gasquet",
                "Fabio Fognini",
                "Dominic Thiem",
                "Denis Shapovalov",
                "Milos Raonic",
                "Kei Nishikori",
                "Emil Ruusuvuori",
                "Daniel Altmaier",
                "Arthur Cazaux",
                "Luca Nardi",
                "Botic van de Zandschulp",
              ])
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync Men&apos;s Tennis (Top 75)
          </button>

          <button
            onClick={() =>
              seedManualLeague(13, [
                "Iga Swiatek",
                "Aryna Sabalenka",
                "Coco Gauff",
                "Elena Rybakina",
                "Jessica Pegula",
                "Zheng Qinwen",
                "Marketa Vondrousova",
                "Maria Sakkari",
                "Ons Jabeur",
                "Jelena Ostapenko",
                "Daria Kasatkina",
                "Karolina Muchova",
                "Emma Navarro",
                "Jasmine Paolini",
                "Naomi Osaka",
                "Danielle Collins",
                "Madison Keys",
                "Elina Svitolina",
                "Ekaterina Alexandrova",
                "Anastasia Pavlyuchenkova",
                "Caroline Garcia",
                "Marta Kostyuk",
                "Victoria Azarenka",
                "Beatriz Haddad Maia",
                "Sorana Cirstea",
                "Elise Mertens",
                "Dayana Yastremska",
                "Linda Noskova",
                "Katie Boulter",
                "Leylah Fernandez",
                "Anastasia Potapova",
                "Anna Kalinskaya",
                "Donna Vekic",
                "Yulia Putintseva",
                "Paula Badosa",
                "Emma Raducanu",
                "Caroline Wozniacki",
                "Angelique Kerber",
                "Bianca Andreescu",
                "Sloane Stephens",
                "Sofia Kenin",
                "Karolina Pliskova",
                "Petra Kvitova",
                "Katerina Siniakova",
                "Barbora Krejcikova",
                "Taylor Townsend",
                "Zhu Lin",
                "Wang Xinyu",
                "Wang Xiyu",
                "Yuan Yue",
                "Sara Sorribes Tormo",
                "Magda Linette",
                "Magdalena Frech",
                "Lucia Bronzetti",
                "Elisabetta Cocciaretto",
                "Martina Trevisan",
                "Anhelina Kalinina",
                "Lesia Tsurenko",
                "Clara Burel",
                "Diane Parry",
                "Varvara Gracheva",
                "Anna Blinkova",
                "Elina Avanesyan",
                "Kamilla Rakhimova",
                "Diana Shnaider",
                "Peyton Stearns",
                "Ashlyn Krueger",
                "Alycia Parks",
                "Katie Volynets",
                "Caroline Dolehide",
                "Robin Montgomery",
                "Alex Eala",
                "Brenda Fruhvirtova",
                "Linda Fruhvirtova",
                "Mirra Andreeva",
              ])
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync Women&apos;s Tennis (Top 75)
          </button>

          <button
            onClick={() =>
              seedManualLeague(14, [
                "Scottie Scheffler",
                "Rory McIlroy",
                "Xander Schauffele",
                "Jon Rahm",
                "Wyndham Clark",
                "Viktor Hovland",
                "Collin Morikawa",
                "Patrick Cantlay",
                "Ludvig Aberg",
                "Bryson DeChambeau",
                "Max Homa",
                "Hideki Matsuyama",
                "Tommy Fleetwood",
                "Brooks Koepka",
                "Jordan Spieth",
                "Matt Fitzpatrick",
                "Tyrrell Hatton",
                "Sam Burns",
                "Sahith Theegala",
                "Justin Thomas",
                "Cameron Young",
                "Jason Day",
                "Keegan Bradley",
                "Tom Kim",
                "Sungjae Im",
                "Joaquin Niemann",
                "Cameron Smith",
                "Tony Finau",
                "Shane Lowry",
                "Will Zalatoris",
                "Russell Henley",
                "Sepp Straka",
                "Brian Harman",
                "Corey Conners",
                "Justin Rose",
                "Adam Scott",
                "Rickie Fowler",
                "Chris Kirk",
                "J.T. Poston",
                "Denny McCarthy",
                "Lucas Glover",
                "Eric Cole",
                "Harris English",
                "Cam Davis",
                "Min Woo Lee",
                "Alex Noren",
                "Emiliano Grillo",
                "Tom Hoge",
                "Mackenzie Hughes",
                "Austin Eckroat",
                "Matthieu Pavon",
                "Akshay Bhatia",
                "Jake Knapp",
                "Nick Dunlap",
                "Stephan Jaeger",
                "Taylor Pendrith",
                "Nick Taylor",
                "Robert MacIntyre",
                "Ryan Fox",
                "Victor Perez",
                "Patrick Reed",
                "Sergio Garcia",
                "Louis Oosthuizen",
                "Dean Burmester",
                "Talor Gooch",
                "Abraham Ancer",
                "Carlos Ortiz",
                "David Puig",
                "Adrian Meronk",
                "Lucas Herbert",
                "Thomas Pieters",
                "Peter Uihlein",
                "Dustin Johnson",
                "Phil Mickelson",
                "Webb Simpson",
              ])
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync PGA Golf (Top 75)
          </button>

          <button
            onClick={() =>
              seedManualLeague(15, [
                "Nelly Korda",
                "Lilia Vu",
                "Celine Boutier",
                "Ruoning Yin",
                "Minjee Lee",
                "Jin Young Ko",
                "Charley Hull",
                "Lydia Ko",
                "Brooke Henderson",
                "Megan Khang",
                "Rose Zhang",
                "Lexi Thompson",
                "Ayaka Furue",
                "Patty Tavatanakit",
                "Atthaya Thitikul",
                "Amy Yang",
                "Allisen Corpuz",
                "Yuka Saso",
                "Leona Maguire",
                "Xiyu Lin",
                "Hannah Green",
                "Hyo Joo Kim",
                "Eun-Hee Ji",
                "So Yeon Ryu",
                "In Gee Chun",
                "Jeongeun Lee6",
                "Hinako Shibuno",
                "Jessica Korda",
                "Jennifer Kupcho",
                "Ally Ewing",
                "Cheyenne Knight",
                "Gaby Lopez",
                "Marina Alex",
                "Gerina Piller",
                "Stacy Lewis",
                "Morgan Pressel",
                "Cristie Kerr",
                "Paula Creamer",
                "Ashleigh Buhai",
                "Madelene Sagstrom",
                "Maja Stark",
                "Linn Grant",
                "Anna Nordqvist",
                "Perrine Delacour",
                "Matilda Castren",
                "Aditi Ashok",
                "Stephanie Meadow",
                "Angel Yin",
                "Yu Liu",
                "Weiwei Zhang",
                "Mi Hyang Lee",
                "Hye-Jin Choi",
                "A Lim Kim",
                "Sung Hyun Park",
                "Mirim Lee",
                "Haru Nomura",
                "Nasa Hataoka",
                "Miyu Yamashita",
                "Akie Iwai",
                "Sakura Koiwai",
                "Mao Saigo",
                "Ai Suzuki",
                "Momoko Ueda",
                "Sayaka Takahashi",
                "Minami Katsu",
                "Ayano Katsumin",
                "Gemma Dryburgh",
                "Jodi Ewart Shadoff",
                "Georgia Hall",
                "Sarah Schmelzel",
                "Alison Lee",
                "Ryann O'Toole",
                "Lizette Salas",
                "Mina Harigae",
                "Brittany Lincicome",
              ])
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync LPGA Golf (Top 75)
          </button>

          <button
            onClick={() =>
              seedManualLeague(17, [
                "Islam Makhachev",
                "Jon Jones",
                "Alex Pereira",
                "Ilia Topuria",
                "Sean O'Malley",
                "Dricus Du Plessis",
                "Alexandre Pantoja",
                "Leon Edwards",
                "Tom Aspinall",
                "Max Holloway",
                "Justin Gaethje",
                "Charles Oliveira",
                "Khamzat Chimaev",
                "Sean Strickland",
                "Israel Adesanya",
                "Alexander Volkanovski",
                "Kamaru Usman",
                "Colby Covington",
                "Dustin Poirier",
                "Arman Tsarukyan",
                "Robert Whittaker",
                "Marvin Vettori",
                "Jared Cannonier",
                "Arnold Allen",
                "Movsar Evloev",
                "Aljamain Sterling",
                "Cory Sandhagen",
                "Joshua Van",
                "Petr Yan",
                "Merab Dvalishvili",
                "Deiveson Figueiredo",
                "Brandon Royval",
                "Kai Kara-France",
                "Brandon Moreno",
                "Amir Albazi",
                "Steve Erceg",
                "Curtis Blaydes",
                "Sergei Pavlovich",
                "Ciryl Gane",
                "Jairzinho Rozenstruik",
                "Jailton Almeida",
                "Alexander Volkov",
                "Serghei Spivac",
                "Derrick Lewis",
                "Tai Tuivasa",
                "Khalil Rountree",
                "Jiri Prochazka",
                "Magomed Ankalaev",
                "Jan Blachowicz",
                "Aleksandar Rakic",
                "Nikita Krylov",
                "Johnny Walker",
                "Jamahal Hill",
                "Volkan Oezdemir",
                "Geoff Neal",
                "Sean Brady",
                "Jack Della Maddalena",
                "Ian Machado Garry",
                "Shavkat Rakhmonov",
                "Kevin Holland",
                "Vicente Luque",
                "Jalin Turner",
                "Dan Hooker",
                "Renato Moicano",
                "Grant Dawson",
                "Bobby Green",
                "Benoit Saint Denis",
                "Matt Frevola",
                "Rafael Fiziev",
                "Mateusz Gamrot",
                "Beneil Dariush",
                "Michael Chandler",
                "Brian Ortega",
                "Yair Rodriguez",
                "Calvin Kattar",
                "Giga Chikadze",
              ])
            }
            className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-sm font-bold transition"
          >
            Sync UFC Fighters (Top 75)
          </button>
        </div>
      </div>
    </main>
  );
}
