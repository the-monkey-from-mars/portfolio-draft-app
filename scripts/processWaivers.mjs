import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function processWaivers() {
  console.log("🕵️ Commissioner Bot waking up...");

  // 1. Find sports whose deadline has passed
  const { data: sports, error: sportsError } = await supabase
    .from("sports")
    .select("id, name, waiver_deadline")
    .lt("waiver_deadline", new Date().toISOString());

  if (sportsError || !sports || sports.length === 0) {
    console.log("✅ No sports have a passed deadline. Going back to sleep.");
    return;
  }

  // 2. Fetch all Pending Claims for these sports
  const sportIds = sports.map((s) => s.id);
  const { data: claims, error: claimsError } = await supabase
    .from("waiver_claims")
    .select("*")
    .in("sport_id", sportIds)
    .eq("status", "pending")
    .order("preference_order", { ascending: true });

  if (claimsError || !claims || claims.length === 0) {
    console.log("✅ No pending claims to process. Going back to sleep.");
    return;
  }

  console.log(
    `📋 Found ${claims.length} pending claims across ${sports.length} past-deadline sports.`,
  );

  // 3. Process Sport by Sport to avoid overlapping priority chaos
  for (const sport of sports) {
    const sportClaims = claims.filter((c) => c.sport_id === sport.id);
    if (sportClaims.length === 0) continue;

    console.log(`\n========================================`);
    console.log(`🏈 Processing Waivers for: ${sport.name}`);
    console.log(`========================================`);

    // Fetch current Users and their Priority
    let { data: users } = await supabase
      .from("users")
      .select("id, name, waiver_priority")
      .eq("is_active", true);

    // Fetch Current Drafted Roster for this sport
    let { data: roster } = await supabase
      .from("roster_picks")
      .select("*")
      .eq("sport_id", sport.id);

    let processingComplete = false;

    // The Rolling Priority Loop
    while (!processingComplete) {
      users.sort((a, b) => a.waiver_priority - b.waiver_priority);
      let claimsProcessedInThisRound = 0;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const userClaims = sportClaims.filter(
          (c) => c.user_id === user.id && c.status === "pending",
        );
        if (userClaims.length === 0) continue;

        let userWonAClaim = false;

        for (const claim of userClaims) {
          const targetTaken = roster.some(
            (p) => p.entity_id === claim.add_entity_id,
          );
          const dropOwned = roster.some(
            (p) =>
              p.user_id === user.id && p.entity_id === claim.drop_entity_id,
          );

          if (targetTaken) {
            console.log(
              `❌ [REJECTED] ${user.name} wanted Team ID ${claim.add_entity_id}, but it was TAKEN.`,
            );
            claim.status = "rejected - target taken";
            await supabase
              .from("waiver_claims")
              .update({ status: claim.status })
              .eq("id", claim.id);
            continue;
          }

          if (!dropOwned) {
            console.log(
              `❌ [REJECTED] ${user.name} tried to drop Team ID ${claim.drop_entity_id}, but they no longer own it.`,
            );
            claim.status = "rejected - drop unavailable";
            await supabase
              .from("waiver_claims")
              .update({ status: claim.status })
              .eq("id", claim.id);
            continue;
          }

          // 🎉 SUCCESS
          console.log(
            `✅ [APPROVED] ${user.name} drops Team ${claim.drop_entity_id} and adds Team ${claim.add_entity_id}!`,
          );

          const pickToUpdate = roster.find(
            (p) =>
              p.user_id === user.id && p.entity_id === claim.drop_entity_id,
          );
          await supabase
            .from("roster_picks")
            .update({ entity_id: claim.add_entity_id })
            .eq("id", pickToUpdate.id);
          pickToUpdate.entity_id = claim.add_entity_id;

          claim.status = "approved";
          await supabase
            .from("waiver_claims")
            .update({ status: "approved" })
            .eq("id", claim.id);

          await supabase.from("transaction_log").insert({
            user_id: user.id,
            sport_id: sport.id,
            dropped_entity_id: claim.drop_entity_id,
            added_entity_id: claim.add_entity_id,
            season_year: claim.season_year || "2026-2027",
            transaction_type: "waiver_claim",
          });

          for (const remaining of userClaims) {
            if (
              remaining.status === "pending" &&
              remaining.drop_entity_id === claim.drop_entity_id
            ) {
              remaining.status = "rejected - already dropped";
              await supabase
                .from("waiver_claims")
                .update({ status: remaining.status })
                .eq("id", remaining.id);
            }
          }

          userWonAClaim = true;
          claimsProcessedInThisRound++;
          break;
        }

        if (userWonAClaim) {
          const maxPriority = Math.max(...users.map((u) => u.waiver_priority));
          user.waiver_priority = maxPriority + 1;
          break;
        }
      }

      if (claimsProcessedInThisRound === 0) {
        processingComplete = true;
      }
    }

    const leftoverClaims = sportClaims.filter((c) => c.status === "pending");
    for (const leftover of leftoverClaims) {
      await supabase
        .from("waiver_claims")
        .update({ status: "rejected - unviable" })
        .eq("id", leftover.id);
    }

    users.sort((a, b) => a.waiver_priority - b.waiver_priority);
    for (let j = 0; j < users.length; j++) {
      await supabase
        .from("users")
        .update({ waiver_priority: j + 1 })
        .eq("id", users[j].id);
    }

    console.log(`🏁 Finished processing ${sport.name}. New priorities saved.`);
  }

  console.log("\n🏆 All waivers processed successfully!");
}

processWaivers().catch(console.error);
