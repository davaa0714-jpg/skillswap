import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "No userId" }, { status: 400 });

  // 1️⃣ Current user
  const { data: me, error: meError } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (meError || !me) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // 2️⃣ Candidates: teach ↔ learn
  const { data: candidates, error: candidatesError } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", userId)
    .eq("teach_skill", me.learn_skill)
    .eq("learn_skill", me.teach_skill);

  if (candidatesError) return NextResponse.json({ error: candidatesError.message });
  if (!candidates || candidates.length === 0) return NextResponse.json({ message: "No matches found" });

  // 3️⃣ Create matches if not exist
  let createdCount = 0;
  for (const other of candidates) {
    // Check if match already exists (bidirectional)
    const { data: existing } = await supabase
      .from("matches")
      .select("*")
      .or(`(user1.eq.${userId},user2.eq.${other.id}),(user1.eq.${other.id},user2.eq.${userId})`);

    if (existing && existing.length > 0) continue;

    await supabase.from("matches").insert({
      user1: userId,
      user2: other.id,
      status: "pending",
    });
    createdCount++;
  }

  return NextResponse.json({ message: "Matches created", matchesCreated: createdCount });
}
