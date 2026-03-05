"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { SPORT_CONFIG } from "../../lib/sportConfig";

export default function ManagerOffice() {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- DASHBOARD STATE ---
  const [currentUser, setCurrentUser] = useState(null);
  const [roster, setRoster] = useState([]);
  const [sportsData, setSportsData] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);

  // --- WAIVER MODAL STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeWaiverSport, setActiveWaiverSport] = useState(null);
  const [activeDropPickId, setActiveDropPickId] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [selectedAddTeamId, setSelectedAddTeamId] = useState("");
  const [waiverStatusMsg, setWaiverStatusMsg] = useState("");

  // 1. Fetch Users on Load for Login
  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase
        .from("users")
        .select("id, name")
        .eq("is_active", true);
      setUsers(data || []);
    }
    fetchUsers();
  }, []);

  // 2. Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!selectedUserId || !pinInput) {
      setLoginError("Please select your name and enter your PIN.");
      return;
    }
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", selectedUserId)
      .single();

    if (error || user.manager_pin !== pinInput) {
      setLoginError("Incorrect PIN.");
      setPinInput("");
    } else {
      setCurrentUser(user);
      setIsAuthenticated(true);
      loadManagerData(user.id);
    }
  };

  // 3. Load ALL Manager Data (Roster, Deadlines, and Pending Claims)
  const loadManagerData = async (userId) => {
    const { data: picks } = await supabase
      .from("roster_picks")
      .select(
        `id, sport_id, api_season_year, entity_id, entities(display_name)`,
      )
      .eq("user_id", userId);

    const { data: sports } = await supabase
      .from("sports")
      .select("id, name, waiver_deadline");

    // Fetch their pending claims and join the entity names for easy display
    const { data: claims } = await supabase
      .from("waiver_claims")
      .select(
        `
        id, sport_id, drop_entity_id, add_entity_id, preference_order,
        drop_entity:entities!waiver_claims_drop_entity_id_fkey(display_name),
        add_entity:entities!waiver_claims_add_entity_id_fkey(display_name)
      `,
      )
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("sport_id")
      .order("preference_order", { ascending: true });

    setRoster(picks || []);
    setSportsData(sports || []);
    setPendingClaims(claims || []);
  };

  // 4. Open Waiver Modal
  const openWaiverModal = async (sportId, pickId) => {
    setWaiverStatusMsg("Loading available teams...");
    setActiveWaiverSport(sportId);
    setActiveDropPickId(pickId);
    setIsModalOpen(true);

    const { data: allTeams } = await supabase
      .from("entities")
      .select("id, display_name")
      .eq("sport_id", sportId)
      .order("display_name");

    const { data: draftedPicks } = await supabase
      .from("roster_picks")
      .select("entity_id")
      .eq("sport_id", sportId)
      .not("entity_id", "is", null);

    const draftedTeamIds = new Set(draftedPicks.map((p) => p.entity_id));
    const freeAgents = allTeams.filter((t) => !draftedTeamIds.has(t.id));

    setAvailableTeams(freeAgents);
    setWaiverStatusMsg("");
  };

  // 5. Submit New Claim
  const submitWaiverClaim = async () => {
    if (!selectedAddTeamId) {
      setWaiverStatusMsg("⚠️ Please select a team to add.");
      return;
    }
    setWaiverStatusMsg("Submitting claim...");

    const dropPick = roster.find((p) => p.id === activeDropPickId);
    const dropEntityId = dropPick ? dropPick.entity_id : null;

    // Figure out the next preference order for this sport
    const existingClaimsForSport = pendingClaims.filter(
      (c) => c.sport_id === activeWaiverSport,
    );
    const nextPref = existingClaimsForSport.length + 1;

    const { error } = await supabase.from("waiver_claims").insert({
      user_id: currentUser.id,
      sport_id: activeWaiverSport,
      drop_entity_id: dropEntityId,
      add_entity_id: selectedAddTeamId,
      season_year: "2026-2027",
      status: "pending",
      preference_order: nextPref,
    });

    if (error) {
      setWaiverStatusMsg("❌ Error submitting claim.");
    } else {
      setWaiverStatusMsg("✅ Claim successfully filed!");
      setTimeout(() => {
        setIsModalOpen(false);
        setSelectedAddTeamId("");
        setWaiverStatusMsg("");
        loadManagerData(currentUser.id); // Refresh dashboard
      }, 1500);
    }
  };

  // 6. Delete a Claim
  const deleteClaim = async (claimId) => {
    await supabase.from("waiver_claims").delete().eq("id", claimId);
    loadManagerData(currentUser.id);
  };

  // 7. Move Preference Order Up or Down
  const moveClaim = async (sportId, claimIndex, direction) => {
    const claimsForSport = pendingClaims.filter((c) => c.sport_id === sportId);
    if (
      (direction === "up" && claimIndex === 0) ||
      (direction === "down" && claimIndex === claimsForSport.length - 1)
    )
      return;

    // Swap the preference orders in memory
    const targetIndex = direction === "up" ? claimIndex - 1 : claimIndex + 1;
    const currentClaim = claimsForSport[claimIndex];
    const targetClaim = claimsForSport[targetIndex];

    const currentPref = currentClaim.preference_order;
    const targetPref = targetClaim.preference_order;

    // Update DB
    await supabase
      .from("waiver_claims")
      .update({ preference_order: targetPref })
      .eq("id", currentClaim.id);
    await supabase
      .from("waiver_claims")
      .update({ preference_order: currentPref })
      .eq("id", targetClaim.id);

    // Refresh
    loadManagerData(currentUser.id);
  };

  // --- RENDER LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <main className="p-10 text-white max-w-md mx-auto mt-20 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl">
        <h1 className="text-3xl font-bold mb-2 text-center text-blue-400">
          Manager Office
        </h1>
        <form onSubmit={handleLogin} className="space-y-6 mt-6">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full p-3 rounded bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Who are you? --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder="PIN"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full p-3 rounded bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-center tracking-widest text-xl"
          />
          {loginError && (
            <p className="text-red-500 text-sm font-bold text-center">
              {loginError}
            </p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded"
          >
            Unlock Door
          </button>
        </form>
      </main>
    );
  }

  // --- RENDER DASHBOARD ---
  const sortedSports = Object.entries(SPORT_CONFIG)
    .map(([id, config]) => ({ id: Number(id), ...config }))
    .sort((a, b) => a.order - b.order);

  // Group pending claims by sport for the Mission Control display
  const groupedClaims = pendingClaims.reduce((acc, claim) => {
    if (!acc[claim.sport_id]) acc[claim.sport_id] = [];
    acc[claim.sport_id].push(claim);
    return acc;
  }, {});

  return (
    <main className="p-6 md:p-10 text-white max-w-5xl mx-auto min-h-screen">
      <div className="flex justify-between items-end mb-8 border-b border-gray-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">
            {currentUser?.name}&apos;s Front Office
          </h1>
          <p className="text-gray-400 mt-1">
            Waiver Priority:{" "}
            <span className="text-white font-bold">
              {currentUser?.waiver_priority}
            </span>
          </p>
        </div>
        <Link href="/" className="text-gray-400 hover:text-white transition">
          &larr; Exit Office
        </Link>
      </div>

      {/* MISSION CONTROL: PENDING CLAIMS */}
      {pendingClaims.length > 0 && (
        <div className="mb-10 bg-gray-900 border-2 border-yellow-600/50 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-yellow-500">
            Mission Control: Pending Claims
          </h2>
          <div className="space-y-6">
            {Object.keys(groupedClaims).map((sportIdStr) => {
              const sportId = Number(sportIdStr);
              const sportName = SPORT_CONFIG[sportId]?.name || "Unknown Sport";
              const claims = groupedClaims[sportId];

              return (
                <div
                  key={sportId}
                  className="bg-gray-800 p-4 rounded border border-gray-700"
                >
                  <h3 className="font-bold text-lg mb-3 border-b border-gray-700 pb-2">
                    {sportName}
                  </h3>
                  <div className="space-y-2">
                    {claims.map((claim, index) => (
                      <div
                        key={claim.id}
                        className="flex items-center justify-between bg-gray-950 p-3 rounded"
                      >
                        <div className="flex items-center space-x-4">
                          <span className="font-bold text-gray-400 w-6">
                            {index + 1}.
                          </span>
                          <div className="flex flex-col">
                            <span className="text-red-400 text-sm line-through">
                              Drop:{" "}
                              {claim.drop_entity?.display_name ||
                                "Pending Pick..."}
                            </span>
                            <span className="text-green-400 font-bold">
                              Add: {claim.add_entity?.display_name}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2">
                          <div className="flex flex-col space-y-1 mr-4">
                            <button
                              onClick={() => moveClaim(sportId, index, "up")}
                              disabled={index === 0}
                              className="text-gray-400 hover:text-white disabled:opacity-30"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveClaim(sportId, index, "down")}
                              disabled={index === claims.length - 1}
                              className="text-gray-400 hover:text-white disabled:opacity-30"
                            >
                              ▼
                            </button>
                          </div>
                          <button
                            onClick={() => deleteClaim(claim.id)}
                            className="bg-red-900/50 hover:bg-red-900 text-red-400 px-3 py-1 rounded text-xs transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ROSTER DISPLAY */}
      <h2 className="text-2xl font-bold mb-6">Your Roster</h2>
      <div className="space-y-6">
        {sortedSports.map((sportConfig) => {
          const dbSport = sportsData.find((s) => s.id === sportConfig.id);
          const userPicks = roster.filter((p) => p.sport_id === sportConfig.id);
          const deadlineDate = dbSport?.waiver_deadline
            ? new Date(dbSport.waiver_deadline).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "TBD";
          const isDeadlinePassed = dbSport?.waiver_deadline
            ? new Date(dbSport.waiver_deadline) < new Date()
            : false;

          return (
            <div
              key={sportConfig.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex flex-col md:flex-row justify-between shadow-lg"
            >
              <div className="mb-4 md:mb-0 w-full md:w-1/3">
                <h2 className="text-xl font-bold">{sportConfig.name}</h2>
                <p className="text-sm text-blue-400 font-semibold">
                  {sportConfig.dates}
                </p>
                <div className="mt-2 text-sm bg-gray-900 inline-block px-3 py-1 rounded border border-gray-700">
                  <span className="text-gray-400">Deadline: </span>
                  <span
                    className={
                      isDeadlinePassed
                        ? "text-red-400 font-bold"
                        : "text-green-400 font-bold"
                    }
                  >
                    {deadlineDate}
                  </span>
                </div>
              </div>

              <div className="w-full md:w-1/3 space-y-3">
                {userPicks.map((pick) => (
                  <div
                    key={pick.id}
                    className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-700"
                  >
                    <span className="font-bold">
                      {pick.entities
                        ? pick.entities.display_name
                        : "Pending Draft..."}
                    </span>
                    {!isDeadlinePassed && (
                      <button
                        onClick={() => openWaiverModal(sportConfig.id, pick.id)}
                        className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white transition"
                      >
                        Drop / Add
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* WAIVER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-lg max-w-lg w-full relative">
            <h2 className="text-2xl font-bold mb-2 text-white">
              Submit Contingency Claim
            </h2>
            <div className="mb-6 bg-red-900/20 p-4 rounded text-center">
              <p className="text-sm text-gray-400 font-bold mb-1">Dropping</p>
              <p className="text-xl text-red-400 font-bold line-through">
                {roster.find((p) => p.id === activeDropPickId)?.entities
                  ?.display_name || "Pending Draft..."}
              </p>
            </div>
            <div className="mb-6 bg-green-900/20 p-4 rounded">
              <p className="text-sm text-gray-400 font-bold mb-2 text-center">
                Adding
              </p>
              <select
                value={selectedAddTeamId}
                onChange={(e) => setSelectedAddTeamId(e.target.value)}
                className="w-full p-3 rounded bg-gray-800 text-white font-bold"
              >
                <option value="">-- Select Free Agent --</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.display_name}
                  </option>
                ))}
              </select>
            </div>
            {waiverStatusMsg && (
              <p className="text-center font-bold mb-4 text-yellow-400">
                {waiverStatusMsg}
              </p>
            )}
            <div className="flex space-x-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-1/2 bg-gray-700 py-3 rounded"
              >
                Cancel
              </button>
              <button
                onClick={submitWaiverClaim}
                className="w-1/2 bg-green-600 py-3 rounded"
              >
                Queue Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
