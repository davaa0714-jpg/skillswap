import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId, text, fileUrl, fileName, fileType, fileSize } = await req.json();
  if (!matchId || (!text && !fileUrl)) {
    return NextResponse.json({ error: "matchId and text or fileUrl are required" }, { status: 400 });
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
  const { data: matchRow } = await supabaseAdmin
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (!matchRow || (matchRow.user1 !== userId && matchRow.user2 !== userId)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (matchRow.status !== "accepted") {
    return NextResponse.json({ error: "Match not accepted" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      match_id: matchId,
      sender: userId,
      text: text || "",
      file_url: fileUrl ?? null,
      file_name: fileName ?? null,
      file_type: fileType ?? null,
      file_size: fileSize ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
