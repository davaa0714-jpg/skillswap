import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetUserId } = await req.json();
  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server env error" }, { status: 500 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("matches")
    .select("*")
    .or(
      `and(user1.eq.${userId},user2.eq.${targetUserId}),and(user1.eq.${targetUserId},user2.eq.${userId})`
    );

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing && existing.length > 0) {
    const existingMatch = existing[0];

    // Ensure a notification exists for the target user
    const { data: existingNotif } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("type", "match_request")
      .eq("match_id", existingMatch.id)
      .limit(1);

    if (!existingNotif || existingNotif.length === 0) {
      await supabaseAdmin.from("notifications").insert({
        user_id: targetUserId,
        type: "match_request",
        message: "New match request",
        match_id: existingMatch.id,
        is_read: false,
      });
    }

    return NextResponse.json({ data: existingMatch, alreadyExists: true });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("matches")
    .insert({ user1: userId, user2: targetUserId, status: "pending" })
    .select()
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message || "Insert failed" }, { status: 500 });
  }

  await supabaseAdmin.from("notifications").insert({
    user_id: targetUserId,
    type: "match_request",
    message: "New match request",
    match_id: inserted.id,
    is_read: false,
  });

  return NextResponse.json({ data: inserted });
}
