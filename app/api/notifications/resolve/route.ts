import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { notificationId, action } = await req.json();
  if (!notificationId || !action) {
    return NextResponse.json({ error: "notificationId and action are required" }, { status: 400 });
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

  const { data: notif, error: notifError } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .single();

  if (notifError || !notif) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  if (notif.type === "match_request" && notif.match_id) {
    if (action === "accept") {
      const { data: updatedMatch, error: updateError } = await supabaseAdmin
        .from("matches")
        .update({ status: "accepted" })
        .eq("id", notif.match_id)
        .select()
        .single();
      if (updateError || !updatedMatch) {
        return NextResponse.json({ error: updateError?.message || "Failed to update match" }, { status: 500 });
      }
      await supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", notificationId);
      return NextResponse.json({ ok: true, match: updatedMatch });
    }
    if (action === "reject") {
      const { error: deleteError } = await supabaseAdmin.from("matches").delete().eq("id", notif.match_id);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
      await supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", notificationId);
      return NextResponse.json({ ok: true, matchId: notif.match_id, deleted: true });
    }
  }

  await supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", notificationId);

  return NextResponse.json({ ok: true });
}
