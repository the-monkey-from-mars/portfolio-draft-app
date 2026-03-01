"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { SPORT_CONFIG } from "../lib/sportConfig";

/**
 * AdminRosterManager
 *
 * A modal-based admin tool for managing drafted roster picks:
 *   - DROP: Release an entity (team/athlete) from a user's roster,
 *     returning the slot to "Pending Draft" and zeroing all scores.
 *   - SWAP: Replace a drafted entity with a different available entity
 *     from the same sport (scores reset to 0).
 *
 * This is the "undo" companion to the existing Draft Room workflow.
 * Think of it like a GM's trade desk — the Draft Room is draft night,
 * and this panel is the waiver wire / release desk.
 *
 * No database migration needed — this operates on existing columns:
 *   roster_picks.entity_id (set to null on drop)
 *   roster_picks.regular_season_score, postseason_score, total_score (zeroed)
 *   roster_picks.is_manual_override, override_note (cleared on drop/swap)
 *
 * Usage:
 *   import AdminRosterManager from "../../components/AdminRosterManager";
 *   <AdminRosterManager />
 */

export default function AdminRosterManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSport, setFilterSport] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);

  // Drop confirmation
  const [confirmDrop, setConfirmDrop] = useState(null);

  // Swap modal
  const [swapPick, setSwapPick] = useState(null);
  const [availableEntities, setAvailableEntities] = useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [entitySearch, setEntitySearch] = useState("");

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Data Fetching ───────────────────────────────────────

  const fetchPicks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("roster_picks")
      .select(
        `
        id, sport_id, entity_id, user_id,
        regular_season_score, postseason_score, total_score,
        is_manual_override, override_note,
        users ( id, name ),
        sports ( name ),
        entities ( id, display_name )
      `,
      )
      .order("sport_id", { ascending: true });

    if (error) {
      console.error("Error fetching picks:", error);
      showToast("Failed to load roster picks", "error");
    } else {
      setPicks(data || []);
    }
    setLoading(false);
  };

  // ─── Filtering ───────────────────────────────────────────

  const sportIds = [...new Set(picks.map((p) => p.sport_id))].sort(
    (a, b) => (SPORT_CONFIG[a]?.order || 99) - (SPORT_CONFIG[b]?.order || 99),
  );

  const filteredPicks = picks.filter((p) => {
    if (filterSport !== "all" && p.sport_id !== Number(filterSport))
      return false;
    if (!showEmpty && p.entity_id === null) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const entityName = (p.entities?.display_name || "").toLowerCase();
      const userName = (p.users?.name || "").toLowerCase();
      const sportName = (
        SPORT_CONFIG[p.sport_id]?.name ||
        p.sports?.name ||
        ""
      ).toLowerCase();
      if (
        !entityName.includes(q) &&
        !userName.includes(q) &&
        !sportName.includes(q)
      )
        return false;
    }
    return true;
  });

  const draftedPicks = filteredPicks.filter((p) => p.entity_id !== null);
  const emptyPicks = filteredPicks.filter((p) => p.entity_id === null);
  const totalEmpty = picks.filter((p) => p.entity_id === null).length;

  // ─── Drop Logic ──────────────────────────────────────────

  const dropEntity = async (pick) => {
    setSaving(true);
    const { error } = await supabase
      .from("roster_picks")
      .update({
        entity_id: null,
        regular_season_score: 0,
        postseason_score: 0,
        total_score: 0,
        is_manual_override: false,
        override_note: null,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", pick.id);

    if (error) {
      console.error("Drop error:", error);
      showToast(`Failed to drop ${pick.entities?.display_name}`, "error");
    } else {
      showToast(
        `Dropped ${pick.entities?.display_name} from ${pick.users?.name}'s roster.`,
      );
      fetchPicks();
    }
    setSaving(false);
    setConfirmDrop(null);
  };

  // ─── Swap Logic ──────────────────────────────────────────

  const openSwapModal = async (pick) => {
    setSwapPick(pick);
    setSelectedEntityId(null);
    setEntitySearch("");

    // Fetch all entities for this sport
    const { data: allEntities } = await supabase
      .from("entities")
      .select("id, display_name")
      .eq("sport_id", pick.sport_id)
      .order("display_name", { ascending: true });

    // Get entity IDs currently drafted in this sport (across all users)
    const draftedIds = picks
      .filter((p) => p.sport_id === pick.sport_id && p.entity_id !== null)
      .map((p) => p.entity_id);

    // Available = not currently on anyone's roster
    const available = (allEntities || []).filter(
      (e) => !draftedIds.includes(e.id),
    );

    setAvailableEntities(available);
  };

  const executeSwap = async () => {
    if (!swapPick || !selectedEntityId) return;
    setSaving(true);

    const { error } = await supabase
      .from("roster_picks")
      .update({
        entity_id: selectedEntityId,
        regular_season_score: 0,
        postseason_score: 0,
        total_score: 0,
        is_manual_override: false,
        override_note: null,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", swapPick.id);

    if (error) {
      console.error("Swap error:", error);
      showToast("Failed to complete swap", "error");
    } else {
      const newName =
        availableEntities.find((e) => e.id === selectedEntityId)
          ?.display_name || "entity";
      const action = swapPick.entity_id ? "Swapped to" : "Assigned";
      showToast(
        `${action} ${newName} on ${swapPick.users?.name}'s ${SPORT_CONFIG[swapPick.sport_id]?.name || ""} slot.`,
      );
      setSwapPick(null);
      fetchPicks();
    }
    setSaving(false);
  };

  const filteredSwapEntities = availableEntities.filter((e) =>
    e.display_name.toLowerCase().includes(entitySearch.toLowerCase()),
  );

  // ─── Render ──────────────────────────────────────────────

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          fetchPicks();
        }}
        className="text-sm bg-red-800 hover:bg-red-700 text-white py-1 px-3 rounded transition"
      >
        Roster Manager
      </button>

      {/* Main Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-5xl w-full relative shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-700 flex-shrink-0">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setConfirmDrop(null);
                  setSwapPick(null);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
              >
                &times;
              </button>
              <h2 className="text-xl font-bold text-red-400">Roster Manager</h2>
              <p className="text-gray-400 text-xs mt-1">
                Drop players to free agency or swap them for available entities.
                Scores reset to 0 on any roster change.
              </p>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 mt-4">
                <select
                  value={filterSport}
                  onChange={(e) => setFilterSport(e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded px-3 py-1.5"
                >
                  <option value="all">All Sports</option>
                  {sportIds.map((id) => (
                    <option key={id} value={id}>
                      {SPORT_CONFIG[id]?.name || `Sport ${id}`}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Search player, team, or manager..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded px-3 py-1.5 flex-grow min-w-[180px]"
                />

                {totalEmpty > 0 && (
                  <button
                    onClick={() => setShowEmpty(!showEmpty)}
                    className={`text-xs px-3 py-1.5 rounded border transition ${
                      showEmpty
                        ? "bg-blue-900/40 border-blue-600 text-blue-300"
                        : "bg-gray-800 border-gray-600 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {showEmpty ? "Hide" : "Show"} {totalEmpty} empty slot
                    {totalEmpty !== 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-grow px-5 pb-2">
              {loading ? (
                <div className="text-center text-gray-500 py-10">
                  Loading roster...
                </div>
              ) : draftedPicks.length === 0 && emptyPicks.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  No picks match your filters.
                </div>
              ) : (
                <table className="w-full text-sm mt-3">
                  <thead className="sticky top-0 bg-gray-900 z-10">
                    <tr className="text-gray-400 text-left border-b border-gray-700">
                      <th className="py-2 pr-2">Sport</th>
                      <th className="py-2 pr-2">Player / Team</th>
                      <th className="py-2 pr-2">Manager</th>
                      <th className="py-2 pr-2 text-right">Total Score</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Drafted picks */}
                    {draftedPicks.map((pick) => (
                      <tr
                        key={pick.id}
                        className={`border-b border-gray-800 hover:bg-gray-800/50 ${
                          pick.is_manual_override ? "bg-amber-950/20" : ""
                        }`}
                      >
                        <td className="py-2 pr-2 text-gray-400">
                          {SPORT_CONFIG[pick.sport_id]?.name ||
                            pick.sports?.name}
                        </td>
                        <td className="py-2 pr-2 text-white font-medium">
                          {pick.entities?.display_name}
                          {pick.is_manual_override && (
                            <span
                              className="ml-2 text-xs bg-amber-800/60 text-amber-300 px-1.5 py-0.5 rounded"
                              title={
                                pick.override_note || "Manual override active"
                              }
                            >
                              Override
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-gray-400">
                          {pick.users?.name || "—"}
                        </td>
                        <td className="py-2 pr-2 text-right font-bold text-green-400">
                          {pick.total_score || 0}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => openSwapModal(pick)}
                            className="text-xs bg-gray-700 hover:bg-blue-700 text-gray-300 hover:text-white px-2 py-1 rounded mr-1 transition"
                            title="Swap for a different free agent entity"
                          >
                            Swap
                          </button>
                          <button
                            onClick={() => setConfirmDrop(pick)}
                            className="text-xs bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white px-2 py-1 rounded transition"
                            title="Release to free agency (zeros scores)"
                          >
                            Drop
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Empty slots (only shown if toggled) */}
                    {showEmpty &&
                      emptyPicks.map((pick) => (
                        <tr
                          key={pick.id}
                          className="border-b border-gray-800 bg-gray-900/50"
                        >
                          <td className="py-2 pr-2 text-gray-500">
                            {SPORT_CONFIG[pick.sport_id]?.name ||
                              pick.sports?.name}
                          </td>
                          <td className="py-2 pr-2 text-gray-500 italic">
                            Empty slot — Pending Draft
                          </td>
                          <td className="py-2 pr-2 text-gray-500">
                            {pick.users?.name || "—"}
                          </td>
                          <td className="py-2 pr-2 text-right text-gray-600">
                            0
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => openSwapModal(pick)}
                              className="text-xs bg-blue-800 hover:bg-blue-700 text-blue-200 hover:text-white px-2 py-1 rounded transition"
                            >
                              Assign
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-700 flex-shrink-0 flex justify-between text-xs text-gray-500">
              <span>
                {draftedPicks.length} drafted pick
                {draftedPicks.length !== 1 ? "s" : ""} shown
                {totalEmpty > 0 && ` · ${totalEmpty} empty slot(s)`}
              </span>
              <span>
                Dropping or swapping resets scores to 0. The cron will
                recalculate on its next run.
              </span>
            </div>
          </div>

          {/* ─── Drop Confirmation Sub-Modal ─── */}
          {confirmDrop && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
              <div className="bg-gray-900 border border-gray-600 rounded-lg max-w-sm w-full p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-red-400 mb-3">
                  Confirm Drop
                </h3>
                <p className="text-gray-300 text-sm mb-1">
                  Release{" "}
                  <span className="font-bold text-white">
                    {confirmDrop.entities?.display_name}
                  </span>{" "}
                  from{" "}
                  <span className="font-bold text-white">
                    {confirmDrop.users?.name}
                  </span>
                  &apos;s{" "}
                  <span className="text-gray-400">
                    {SPORT_CONFIG[confirmDrop.sport_id]?.name || ""}{" "}
                  </span>
                  slot?
                </p>
                <p className="text-gray-500 text-xs mt-2 mb-5">
                  This will zero their scores and return the entity to free
                  agency. The roster slot will become &quot;Pending Draft.&quot;
                  {confirmDrop.is_manual_override && (
                    <span className="text-amber-400 block mt-1">
                      Note: This pick has an active manual override, which will
                      also be cleared.
                    </span>
                  )}
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmDrop(null)}
                    className="text-sm text-gray-400 hover:text-white px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => dropEntity(confirmDrop)}
                    disabled={saving}
                    className="text-sm bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white font-bold px-5 py-2 rounded transition"
                  >
                    {saving ? "Dropping..." : "Drop Player"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Swap / Assign Sub-Modal ─── */}
          {swapPick && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
              <div className="bg-gray-900 border border-gray-600 rounded-lg max-w-md w-full p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-blue-400 mb-1">
                  {swapPick.entity_id ? "Swap" : "Assign"} —{" "}
                  {SPORT_CONFIG[swapPick.sport_id]?.name ||
                    swapPick.sports?.name}
                </h3>
                <p className="text-gray-400 text-sm mb-1">
                  Manager:{" "}
                  <span className="text-white">{swapPick.users?.name}</span>
                </p>
                {swapPick.entity_id && (
                  <p className="text-gray-500 text-xs mb-3">
                    Releasing:{" "}
                    <span className="text-gray-300">
                      {swapPick.entities?.display_name}
                    </span>{" "}
                    — will be returned to free agency and scores will reset to
                    0.
                  </p>
                )}

                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Search available players/teams..."
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded px-3 py-2 text-sm mb-2"
                  />

                  <div className="max-h-48 overflow-y-auto border border-gray-700 rounded bg-gray-800">
                    {filteredSwapEntities.length === 0 ? (
                      <div className="text-gray-500 text-sm text-center py-4">
                        {availableEntities.length === 0
                          ? "No available entities — all are drafted."
                          : "No entities match your search."}
                      </div>
                    ) : (
                      filteredSwapEntities.map((entity) => (
                        <button
                          key={entity.id}
                          onClick={() => setSelectedEntityId(entity.id)}
                          className={`w-full text-left px-3 py-2 text-sm border-b border-gray-700 last:border-b-0 transition ${
                            selectedEntityId === entity.id
                              ? "bg-blue-900/50 text-blue-300 font-medium"
                              : "text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          {entity.display_name}
                        </button>
                      ))
                    )}
                  </div>

                  {selectedEntityId && (
                    <div className="mt-2 text-sm text-blue-300">
                      Selected:{" "}
                      <span className="font-bold">
                        {
                          availableEntities.find(
                            (e) => e.id === selectedEntityId,
                          )?.display_name
                        }
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-5">
                  <button
                    onClick={() => setSwapPick(null)}
                    className="text-sm text-gray-400 hover:text-white px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeSwap}
                    disabled={saving || !selectedEntityId}
                    className="text-sm bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold px-5 py-2 rounded transition"
                  >
                    {saving
                      ? "Saving..."
                      : swapPick.entity_id
                        ? "Swap & Assign"
                        : "Assign"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div
              className={`fixed bottom-6 right-6 z-[70] px-4 py-3 rounded shadow-lg text-sm font-medium ${
                toast.type === "error"
                  ? "bg-red-900 text-red-200 border border-red-700"
                  : "bg-green-900 text-green-200 border border-green-700"
              }`}
            >
              {toast.message}
            </div>
          )}
        </div>
      )}
    </>
  );
}
