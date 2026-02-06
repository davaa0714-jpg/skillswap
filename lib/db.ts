// src/lib/db.ts
import { supabase } from "./supabase";
import type { Profile, Match, Message } from "@/types";

// --------------------
// Profiles
// --------------------
export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*");
  if (error) throw error;
  return data || [];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data || null;
}

export async function createProfile(profile: Omit<Profile, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("profiles")
    .insert(profile)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --------------------
// Matches
// --------------------
export async function findMatches(profileId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", profileId)           // өөрийгөө авахгүй
    .eq("teach_skill", (await getProfile(profileId))?.learn_skill)
    .eq("learn_skill", (await getProfile(profileId))?.teach_skill);
  if (error) throw error;
  return data || [];
}

// --------------------
// Messages
// --------------------
export async function sendMessage(matchId: number, sender: string, text: string) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender, text })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMessages(matchId: number): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
