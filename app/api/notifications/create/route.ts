import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetUserId, matchId, message } = await req.json();
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

  const senderId = userData.user.id;
  const { data: senderProfile } = await supabaseAdmin
    .from("profiles")
    .select("name")
    .eq("id", senderId)
    .single();
  const senderName = senderProfile?.name || "Someone";

  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: targetUserId,
    type: "match_request",
    message: message || `New match request from ${senderName}`,
    match_id: matchId ?? null,
    is_read: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
