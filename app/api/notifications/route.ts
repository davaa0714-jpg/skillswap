import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matchIds = (data || [])
    .filter(n => n.type === "match_request" && n.match_id)
    .map(n => n.match_id);
  const uniqueMatchIds = Array.from(new Set(matchIds));

  if (uniqueMatchIds.length === 0) {
    return NextResponse.json({ data });
  }

  const { data: matches, error: matchesError } = await supabaseAdmin
    .from("matches")
    .select("id,user1,user2")
    .in("id", uniqueMatchIds);

  if (matchesError) {
    return NextResponse.json({ data });
  }

  const senderIds = Array.from(
    new Set(
      (matches || []).map(m => (m.user1 === userData.user.id ? m.user2 : m.user1))
    )
  );

  if (senderIds.length === 0) {
    return NextResponse.json({ data });
  }

  const { data: senderProfiles, error: senderProfilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,name,avatar_url")
    .in("id", senderIds);

  if (senderProfilesError) {
    return NextResponse.json({ data });
  }

  const matchMap = new Map((matches || []).map(m => [m.id, m]));
  const profileMap = new Map((senderProfiles || []).map(p => [p.id, { name: p.name, avatar_url: p.avatar_url }]));

  const enriched = (data || []).map(n => {
    if (n.type !== "match_request" || !n.match_id) return n;
    const m = matchMap.get(n.match_id);
    if (!m) return n;
    const senderId = m.user1 === userData.user.id ? m.user2 : m.user1;
    const senderProfile = profileMap.get(senderId);
    return {
      ...n,
      sender_id: senderId,
      sender_name: senderProfile?.name || null,
      sender_avatar_url: senderProfile?.avatar_url || null,
    };
  });

  return NextResponse.json({ data: enriched });
}
