"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { SPORT_CONFIG } from "../lib/sportConfig";
import { SCORING_SCHEMAS } from "../lib/scoringSchemas";

export default function AdminScoreOverride() {
  const [isOpen, setIsOpen] = useState(false);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [filterSport, setFilterSport] = useState("all");
  const [filterOverride, setFilterOverride] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);

  // Edit state
  const [editingPick, setEditingPick] = useState(null);
  const [regInputs, setRegInputs] = useState({});
  const [postMilestones, setPostMilestones] = useState([]);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");

  // Live-computed preview scores
  const [previewRegScore, setPreviewRegScore] = useState(0);
  const [previewPostScore, setPreviewPostScore] = useState(0);

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
        `id, sport_id, regular_season_score, postseason_score, total_score,
        is_manual_override, override_note, last_updated_at, score_breakdown,
        users ( name ), sports ( name ), entities ( display_name )`,
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

  // ─── Live Recompute ──────────────────────────────────────

  const recomputePreview = (schema, inputs, milestones) => {
    if (!schema) return;
    const regResult = schema.regularSeason.compute(inputs);
    setPreviewRegScore(regResult.score);
    const postScore = schema.postseason.computeFromMilestones(milestones);
    setPreviewPostScore(postScore);
  };

  // ─── Open Editor ─────────────────────────────────────────

  const openEditor = (pick) => {
    setEditingPick(pick);
    setIsManualOverride(pick.is_manual_override || false);
    setOverrideNote(pick.override_note || "");

    const schema = SCORING_SCHEMAS[pick.sport_id];
    const existing = pick.score_breakdown;

    if (schema) {
      // Pre-populate regular season inputs from existing breakdown
      const defaultRegInputs = {};
      schema.regularSeason.fields.forEach((field) => {
        const saved = existing?.regularSeason?.inputs?.[field.key];
        if (saved !== undefined && saved !== null) {
          defaultRegInputs[field.key] = saved;
        } else {
          defaultRegInputs[field.key] = field.type === "checkbox" ? false : "";
        }
      });
      setRegInputs(defaultRegInputs);

      // Pre-populate milestones from existing breakdown
      const defaultMilestones = schema.postseason.milestones.map((m) => {
        const saved = existing?.postseason?.milestones?.find(
          (sm) => sm.label === m.label,
        );
        if (m.type === "event" && m.tiers) {
          let savedTier = 0;
          if (saved && saved.detail) {
            const tierIdx = m.tiers.findIndex((t) => t.label === saved.detail);
            if (tierIdx > 0) savedTier = tierIdx;
          }
          return { ...m, selectedTier: savedTier };
        }
        return { ...m, achieved: saved ? saved.achieved : false };
      });
      setPostMilestones(defaultMilestones);

      recomputePreview(schema, defaultRegInputs, defaultMilestones);
    } else {
      setRegInputs({ rawRegScore: pick.regular_season_score || 0 });
      setPostMilestones([]);
      setPreviewRegScore(pick.regular_season_score || 0);
      setPreviewPostScore(pick.postseason_score || 0);
    }
  };

  // ─── Input Handlers ──────────────────────────────────────

  const handleRegInputChange = (key, value, fieldType) => {
    const newInputs = { ...regInputs };
    if (fieldType === "checkbox") {
      newInputs[key] = value;
    } else if (fieldType === "text") {
      newInputs[key] = value;
    } else {
      newInputs[key] = value === "" ? "" : Number(value);
    }
    setRegInputs(newInputs);
    const schema = SCORING_SCHEMAS[editingPick.sport_id];
    if (schema) recomputePreview(schema, newInputs, postMilestones);
  };

  const handleMilestoneToggle = (index) => {
    const updated = [...postMilestones];
    updated[index] = { ...updated[index], achieved: !updated[index].achieved };
    setPostMilestones(updated);
    const schema = SCORING_SCHEMAS[editingPick.sport_id];
    if (schema) recomputePreview(schema, regInputs, updated);
  };

  const handleEventTierChange = (index, tierIndex) => {
    const updated = [...postMilestones];
    updated[index] = { ...updated[index], selectedTier: tierIndex };
    setPostMilestones(updated);
    const schema = SCORING_SCHEMAS[editingPick.sport_id];
    if (schema) recomputePreview(schema, regInputs, updated);
  };

  // ─── Save ────────────────────────────────────────────────

  const saveOverride = async () => {
    if (!editingPick) return;
    setSaving(editingPick.id);

    const schema = SCORING_SCHEMAS[editingPick.sport_id];
    let regularSeasonScore, postseasonScore, scoreBreakdown;

    if (schema) {
      const regResult = schema.regularSeason.compute(regInputs);
      regularSeasonScore = regResult.score;
      postseasonScore = schema.postseason.computeFromMilestones(postMilestones);

      const regBreakdown = schema.regularSeason.buildBreakdown(
        regInputs,
        regularSeasonScore,
        regResult.derived || {},
      );
      const postBreakdown = schema.postseason.buildBreakdown(
        postMilestones,
        postseasonScore,
      );

      scoreBreakdown = {
        sportType: schema.sportType,
        regularSeason: regBreakdown,
        postseason: postBreakdown,
      };
    } else {
      regularSeasonScore = Number(regInputs.rawRegScore) || 0;
      postseasonScore = 0;
      scoreBreakdown = null;
    }

    const totalScore = regularSeasonScore + postseasonScore;

    const { error } = await supabase
      .from("roster_picks")
      .update({
        regular_season_score: regularSeasonScore,
        postseason_score: postseasonScore,
        total_score: totalScore,
        is_manual_override: isManualOverride,
        override_note: overrideNote || null,
        score_breakdown: scoreBreakdown,
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
      fetchPicks();
    }
    setSaving(null);
  };

  const clearOverride = async (pick) => {
    const { error } = await supabase
      .from("roster_picks")
      .update({ is_manual_override: false, override_note: null })
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

  // ─── Filtering ───────────────────────────────────────────

  const filteredPicks = picks.filter((p) => {
    if (filterSport !== "all" && p.sport_id !== Number(filterSport))
      return false;
    if (filterOverride === "overrides" && !p.is_manual_override) return false;
    if (filterOverride === "auto" && p.is_manual_override) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const eName = (p.entities?.display_name || "").toLowerCase();
      const uName = (p.users?.name || "").toLowerCase();
      if (!eName.includes(q) && !uName.includes(q)) return false;
    }
    return true;
  });

  const sportIds = [...new Set(picks.map((p) => p.sport_id))].sort(
    (a, b) => (SPORT_CONFIG[a]?.order || 99) - (SPORT_CONFIG[b]?.order || 99),
  );

  // ─── Helpers for event-tier point display ────────────────

  const getEventPoints = (milestone) => {
    const sel = milestone.selectedTier || 0;
    if (sel === 0) return 0;
    if (milestone.cumulative) {
      let pts = 0;
      for (let i = 1; i <= sel; i++) pts += milestone.tiers[i]?.pts || 0;
      return pts;
    }
    return milestone.tiers[sel]?.pts || 0;
  };

  const formatPts = (pts) =>
    Number.isInteger(pts) ? String(pts) : pts.toFixed(1);

  // ─── Current editor schema ───────────────────────────────

  const schema = editingPick ? SCORING_SCHEMAS[editingPick.sport_id] : null;

  // ─── Render ──────────────────────────────────────────────

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
            {/* ── Header ── */}
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
                Enter raw stats and the system computes scores + breakdown
                automatically. Picks marked &quot;Override&quot; are skipped by
                the daily cron.
              </p>

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

            {/* ── Table ── */}
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
                        className={`border-b border-gray-800 hover:bg-gray-800/50 ${pick.is_manual_override ? "bg-amber-950/20" : ""}`}
                      >
                        <td className="py-2 pr-2 text-gray-400">
                          {SPORT_CONFIG[pick.sport_id]?.name ||
                            pick.sports?.name}
                        </td>
                        <td className="py-2 pr-2 text-white font-medium">
                          {pick.entities?.display_name || "—"}
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
                            <span className="text-xs bg-amber-800/60 text-amber-300 px-2 py-0.5 rounded">
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

            {/* ── Footer ── */}
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

          {/* ════════════════════════════════════════════════════
              SPORT-AWARE EDIT SUB-MODAL
              ════════════════════════════════════════════════════ */}
          {editingPick && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
              <div className="bg-gray-900 border border-gray-600 rounded-lg max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh]">
                {/* Edit Header + Live Preview */}
                <div className="p-5 border-b border-gray-700 flex-shrink-0">
                  <h3 className="text-lg font-bold text-white">
                    {editingPick.entities?.display_name}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {SPORT_CONFIG[editingPick.sport_id]?.name ||
                      editingPick.sports?.name}
                    <span className="text-gray-600 ml-2">
                      ({editingPick.users?.name})
                    </span>
                  </p>

                  <div className="flex gap-3 mt-4">
                    <div className="flex-1 bg-gray-800 rounded px-3 py-2 text-center border border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">
                        Regular
                      </div>
                      <div className="text-lg font-bold text-blue-400">
                        {previewRegScore}
                        <span className="text-gray-600 text-xs">/400</span>
                      </div>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded px-3 py-2 text-center border border-gray-700">
                      <div className="text-[10px] text-gray-500 uppercase">
                        Postseason
                      </div>
                      <div className="text-lg font-bold text-yellow-400">
                        {previewPostScore}
                        <span className="text-gray-600 text-xs">/600</span>
                      </div>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded px-3 py-2 text-center border border-green-800/50">
                      <div className="text-[10px] text-gray-500 uppercase">
                        Total
                      </div>
                      <div className="text-lg font-bold text-green-400">
                        {previewRegScore + previewPostScore}
                        <span className="text-gray-600 text-xs">/1000</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Body — scrollable */}
                <div className="overflow-y-auto flex-grow p-5 space-y-6">
                  {schema ? (
                    <>
                      {/* ── Regular Season Inputs ── */}
                      <div>
                        <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wide mb-3">
                          Regular Season Inputs
                        </h4>
                        <div className="space-y-3">
                          {schema.regularSeason.fields.map((field) => (
                            <div key={field.key}>
                              {field.type === "checkbox" ? (
                                <label className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!regInputs[field.key]}
                                    onChange={(e) =>
                                      handleRegInputChange(
                                        field.key,
                                        e.target.checked,
                                        "checkbox",
                                      )
                                    }
                                    className="w-4 h-4 accent-blue-500"
                                  />
                                  <span className="text-sm text-gray-300">
                                    {field.label}
                                  </span>
                                </label>
                              ) : (
                                <div>
                                  <label className="block text-xs text-gray-400 mb-1">
                                    {field.label}
                                  </label>
                                  <input
                                    type={field.type || "number"}
                                    min={field.min}
                                    step={field.step || undefined}
                                    value={regInputs[field.key] ?? ""}
                                    onChange={(e) =>
                                      handleRegInputChange(
                                        field.key,
                                        e.target.value,
                                        field.type || "number",
                                      )
                                    }
                                    className="w-full bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-sm font-mono"
                                    placeholder={
                                      field.required === false
                                        ? "Optional"
                                        : undefined
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Postseason Milestones ── */}
                      <div>
                        <h4 className="text-sm font-bold text-yellow-400 uppercase tracking-wide mb-3">
                          {schema.postseason.label}
                        </h4>
                        <div className="space-y-1.5">
                          {postMilestones.map((milestone, idx) =>
                            milestone.type === "event" && milestone.tiers ? (
                              /* ── Event-Tier Dropdown ── */
                              <div
                                key={idx}
                                className={`text-sm py-2.5 px-3 rounded border transition ${
                                  (milestone.selectedTier || 0) > 0
                                    ? "bg-green-900/20 border-green-800/40"
                                    : "bg-gray-800/30 border-gray-700/30"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span
                                    className={
                                      (milestone.selectedTier || 0) > 0
                                        ? "text-green-300 font-medium"
                                        : "text-gray-400"
                                    }
                                  >
                                    {milestone.label}
                                  </span>
                                  <span
                                    className={`font-bold text-sm ${(milestone.selectedTier || 0) > 0 ? "text-green-400" : "text-gray-600"}`}
                                  >
                                    +{formatPts(getEventPoints(milestone))}
                                  </span>
                                </div>
                                <select
                                  value={milestone.selectedTier || 0}
                                  onChange={(e) =>
                                    handleEventTierChange(
                                      idx,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-full bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded px-2 py-1.5"
                                >
                                  {milestone.tiers.map((tier, tIdx) => (
                                    <option key={tIdx} value={tIdx}>
                                      {tier.label}
                                      {tIdx > 0 ? ` (+${tier.pts})` : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              /* ── Standard Checkbox Milestone ── */
                              <label
                                key={idx}
                                className={`flex items-center justify-between cursor-pointer text-sm py-2.5 px-3 rounded border transition ${
                                  milestone.achieved
                                    ? "bg-green-900/20 border-green-800/40"
                                    : "bg-gray-800/30 border-gray-700/30 hover:border-gray-600"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={milestone.achieved}
                                    onChange={() => handleMilestoneToggle(idx)}
                                    className="w-4 h-4 accent-green-500"
                                  />
                                  <span
                                    className={
                                      milestone.achieved
                                        ? "text-green-300"
                                        : "text-gray-400"
                                    }
                                  >
                                    {milestone.label}
                                  </span>
                                </div>
                                <span
                                  className={`font-bold ${milestone.achieved ? "text-green-400" : "text-gray-600"}`}
                                >
                                  +{milestone.pts}
                                </span>
                              </label>
                            ),
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-gray-400 text-sm mb-4">
                        No sport-specific schema for sport ID{" "}
                        {editingPick.sport_id}. Raw score entry:
                      </p>
                      <label className="block text-xs text-gray-400 mb-1">
                        Regular Season Score (0-400)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="400"
                        value={regInputs.rawRegScore ?? ""}
                        onChange={(e) =>
                          setRegInputs({
                            rawRegScore: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 text-lg font-mono"
                      />
                    </div>
                  )}

                  {/* ── Override Controls ── */}
                  <div className="space-y-3 pt-3 border-t border-gray-700">
                    <div className="flex items-center gap-3 p-3 bg-gray-800 rounded border border-gray-700">
                      <input
                        type="checkbox"
                        id="override-toggle-v2"
                        checked={isManualOverride}
                        onChange={(e) => setIsManualOverride(e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <label
                        htmlFor="override-toggle-v2"
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
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Admin Note{" "}
                        <span className="text-gray-600">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={overrideNote}
                        onChange={(e) => setOverrideNote(e.target.value)}
                        placeholder="e.g., LPGA API down, manual entry from lpga.com"
                        className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Edit Footer */}
                <div className="p-5 border-t border-gray-700 flex-shrink-0 flex justify-end gap-3">
                  <button
                    onClick={() => setEditingPick(null)}
                    className="text-sm text-gray-400 hover:text-white px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveOverride}
                    disabled={saving === editingPick.id}
                    className="text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 text-white font-bold px-6 py-2 rounded transition"
                  >
                    {saving === editingPick.id
                      ? "Saving..."
                      : `Save (${previewRegScore + previewPostScore} pts)`}
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
