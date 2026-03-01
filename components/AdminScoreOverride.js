"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SPORT_CONFIG } from "../lib/sportConfig";

/**
 * AdminScoreOverride
 *
 * A modal-based admin tool that allows manual score entry for any roster pick.
 * Use cases:
 *   - API/scraping failures (LPGA Cloudflare blocks, LOVB site changes)
 *   - Postseason scores not yet automated in sport scripts
 *   - MMA manual fight result logging
 *   - Any correction needed to scraped data
 *
 * Database requirements:
 *   ALTER TABLE roster_picks ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN DEFAULT false;
 *   ALTER TABLE roster_picks ADD COLUMN IF NOT EXISTS override_note TEXT;
 *
 * How it works:
 *   When is_manual_override = true, the masterCron will SKIP that pick entirely,
 *   preserving whatever scores the admin has manually entered.
 *   When is_manual_override = false (default), the cron overwrites as usual.
 */

export default function AdminScoreOverride() {
  const [isOpen, setIsOpen] = useState(false);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null); // pick id currently being saved
  const [filterSport, setFilterSport] = useState("all");
  const [filterOverride, setFilterOverride] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPick, setEditingPick] = useState(null);
  const [editValues, setEditValues] = useState({
    regular_season_score: 0,
    postseason_score: 0,
    is_manual_override: false,
    override_note: "",
  });
  const [toast, setToast] = useState(null);

  // Fetch all roster picks with user and entity info
  const fetchPicks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("roster_picks")
      .select(
        `
        id,
        sport_id,
        regular_season_score,
        postseason_score,
        total_score,
        is_manual_override,
        override_note,
        last_updated_at,
        users ( name ),
        sports ( name ),
        entities ( display_name )
      `,
      )
      .not("entity_id", "is", null)
      .order("sport_id", { ascending: true });

    if (error) {
      console.error("Error fetching picks:", error);
      showToast("Failed to load roster picks", "error");
    } else {
      setPicks(data || []);
    }
    setLoading(false);
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openEditor = (pick) => {
    setEditingPick(pick);
    setEditValues({
      regular_season_score: pick.regular_season_score || 0,
      postseason_score: pick.postseason_score || 0,
      is_manual_override: pick.is_manual_override || false,
      override_note: pick.override_note || "",
    });
  };

  const saveOverride = async () => {
    if (!editingPick) return;
    setSaving(editingPick.id);

    const totalScore =
      Number(editValues.regular_season_score) +
      Number(editValues.postseason_score);

    const { error } = await supabase
      .from("roster_picks")
      .update({
        regular_season_score: Number(editValues.regular_season_score),
        postseason_score: Number(editValues.postseason_score),
        total_score: totalScore,
        is_manual_override: editValues.is_manual_override,
        override_note: editValues.override_note || null,
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", editingPick.id);

    if (error) {
      console.error("Error saving override:", error);
      showToast("Failed to save. Check console.", "error");
    } else {
      showToast(
        `Saved ${editingPick.entities?.display_name || "pick"} — ${totalScore} pts`,
      );
      setEditingPick(null);
      fetchPicks(); // Refresh the list
    }
    setSaving(null);
  };

  const clearOverride = async (pick) => {
    const { error } = await supabase
      .from("roster_picks")
      .update({
        is_manual_override: false,
        override_note: null,
      })
      .eq("id", pick.id);

    if (error) {
      showToast("Failed to clear override", "error");
    } else {
      showToast(
        `Override cleared for ${pick.entities?.display_name}. Cron will resume.`,
      );
      fetchPicks();
    }
  };

  // Filtered picks
  const filteredPicks = picks.filter((p) => {
    if (filterSport !== "all" && p.sport_id !== Number(filterSport))
      return false;
    if (filterOverride === "overrides" && !p.is_manual_override) return false;
    if (filterOverride === "auto" && p.is_manual_override) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const entityName = (p.entities?.display_name || "").toLowerCase();
      const userName = (p.users?.name || "").toLowerCase();
      if (!entityName.includes(q) && !userName.includes(q)) return false;
    }
    return true;
  });

  // Get unique sport IDs from current picks for the filter dropdown
  const sportIds = [...new Set(picks.map((p) => p.sport_id))].sort(
    (a, b) => (SPORT_CONFIG[a]?.order || 99) - (SPORT_CONFIG[b]?.order || 99),
  );

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          fetchPicks();
        }}
        className="text-sm bg-amber-700 hover:bg-amber-600 text-white py-1 px-3 rounded transition"
      >
        Score Overrides
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-5xl w-full relative shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-700 flex-shrink-0">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setEditingPick(null);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold"
              >
                &times;
              </button>
              <h2 className="text-xl font-bold text-amber-400">
                Admin Score Overrides
              </h2>
              <p className="text-gray-400 text-xs mt-1">
                Manually set scores when APIs fail or for postseason data. Picks
                marked as &quot;Override&quot; are skipped by the daily cron.
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

                <select
                  value={filterOverride}
                  onChange={(e) => setFilterOverride(e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded px-3 py-1.5"
                >
                  <option value="all">All Picks</option>
                  <option value="overrides">Overrides Only</option>
                  <option value="auto">Auto-scored Only</option>
                </select>

                <input
                  type="text"
                  placeholder="Search player or manager..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded px-3 py-1.5 flex-grow min-w-[180px]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-grow px-5 pb-2">
              {loading ? (
                <div className="text-center text-gray-500 py-10">
                  Loading picks...
                </div>
              ) : filteredPicks.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  No picks found matching your filters.
                </div>
              ) : (
                <table className="w-full text-sm mt-3">
                  <thead className="sticky top-0 bg-gray-900 z-10">
                    <tr className="text-gray-400 text-left border-b border-gray-700">
                      <th className="py-2 pr-2">Sport</th>
                      <th className="py-2 pr-2">Player / Team</th>
                      <th className="py-2 pr-2">Manager</th>
                      <th className="py-2 pr-2 text-right">Reg</th>
                      <th className="py-2 pr-2 text-right">Post</th>
                      <th className="py-2 pr-2 text-right">Total</th>
                      <th className="py-2 pr-2 text-center">Status</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPicks.map((pick) => (
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
                          {pick.entities?.display_name || "—"}
                        </td>
                        <td className="py-2 pr-2 text-gray-400">
                          {pick.users?.name || "—"}
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-300">
                          {pick.regular_season_score || 0}
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-300">
                          {pick.postseason_score || 0}
                        </td>
                        <td className="py-2 pr-2 text-right font-bold text-green-400">
                          {pick.total_score || 0}
                        </td>
                        <td className="py-2 pr-2 text-center">
                          {pick.is_manual_override ? (
                            <span
                              className="text-xs bg-amber-800/60 text-amber-300 px-2 py-0.5 rounded cursor-help"
                              title={pick.override_note || "Manual override"}
                            >
                              Override
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Auto</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => openEditor(pick)}
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded mr-1"
                          >
                            Edit
                          </button>
                          {pick.is_manual_override && (
                            <button
                              onClick={() => clearOverride(pick)}
                              className="text-xs bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white px-2 py-1 rounded"
                              title="Remove override, let cron resume"
                            >
                              Clear
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer summary */}
            <div className="px-5 py-3 border-t border-gray-700 flex-shrink-0 flex justify-between text-xs text-gray-500">
              <span>
                {filteredPicks.length} pick
                {filteredPicks.length !== 1 ? "s" : ""} shown
                {picks.filter((p) => p.is_manual_override).length > 0 &&
                  ` · ${picks.filter((p) => p.is_manual_override).length} override(s) active`}
              </span>
              <span>Overridden picks are skipped by the daily cron job.</span>
            </div>
          </div>

          {/* Edit sub-modal */}
          {editingPick && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
              <div className="bg-gray-850 border border-gray-600 rounded-lg max-w-md w-full p-6 shadow-2xl bg-gray-900">
                <h3 className="text-lg font-bold text-white mb-1">
                  Edit Score
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {editingPick.entities?.display_name} —{" "}
                  {SPORT_CONFIG[editingPick.sport_id]?.name ||
                    editingPick.sports?.name}
                  <span className="text-gray-600 ml-2">
                    ({editingPick.users?.name})
                  </span>
                </p>

                <div className="space-y-4">
                  {/* Regular Season Score */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Regular Season Score{" "}
                      <span className="text-gray-600">(max 400)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="400"
                      value={editValues.regular_season_score}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          regular_season_score: e.target.value,
                        }))
                      }
                      className="w-full bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-lg font-mono"
                    />
                  </div>

                  {/* Postseason Score */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Postseason Score{" "}
                      <span className="text-gray-600">(max 600)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="600"
                      value={editValues.postseason_score}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          postseason_score: e.target.value,
                        }))
                      }
                      className="w-full bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-lg font-mono"
                    />
                  </div>

                  {/* Total preview */}
                  <div className="bg-gray-800 rounded px-3 py-2 flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Total Score</span>
                    <span className="text-green-400 text-xl font-bold font-mono">
                      {Number(editValues.regular_season_score || 0) +
                        Number(editValues.postseason_score || 0)}
                    </span>
                  </div>

                  {/* Override toggle */}
                  <div className="flex items-center gap-3 p-3 bg-gray-800 rounded border border-gray-700">
                    <input
                      type="checkbox"
                      id="override-toggle"
                      checked={editValues.is_manual_override}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          is_manual_override: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-amber-500"
                    />
                    <label
                      htmlFor="override-toggle"
                      className="text-sm text-gray-300"
                    >
                      <span className="font-medium text-amber-400">
                        Lock as Manual Override
                      </span>
                      <br />
                      <span className="text-xs text-gray-500">
                        When locked, the daily cron will skip this pick and
                        preserve your manual scores.
                      </span>
                    </label>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Admin Note{" "}
                      <span className="text-gray-600">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={editValues.override_note}
                      onChange={(e) =>
                        setEditValues((v) => ({
                          ...v,
                          override_note: e.target.value,
                        }))
                      }
                      placeholder="e.g., LPGA API down, manual entry from lpga.com"
                      className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setEditingPick(null)}
                    className="text-sm text-gray-400 hover:text-white px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveOverride}
                    disabled={saving === editingPick.id}
                    className="text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 text-white font-bold px-5 py-2 rounded transition"
                  >
                    {saving === editingPick.id ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toast notification */}
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
