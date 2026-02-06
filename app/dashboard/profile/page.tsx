"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [teachSkill, setTeachSkill] = useState("");
  const [learnSkill, setLearnSkill] = useState("");

  // 1️⃣ Get current user
  useEffect(() => {
    async function fetchUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    }
    fetchUser();
  }, []);

  // 2️⃣ Fetch existing profile
  useEffect(() => {
    if (!userId) return;

    async function fetchProfile() {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single<Profile>();

      if (data) {
        setProfile(data);
        setName(data.name || "");
        setBio(data.bio || "");
        setTeachSkill(data.teach_skill || "");
        setLearnSkill(data.learn_skill || "");
      }
      setLoading(false);
    }

    fetchProfile();
  }, [userId]);

  // 3️⃣ Save profile + create matches
  const handleSave = async () => {
    if (!userId) return;

    setLoading(true);

    // a) Save / upsert profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      name,
      bio,
      teach_skill: teachSkill,
      learn_skill: learnSkill,
    });

    if (profileError) {
      alert("Error saving profile: " + profileError.message);
      setLoading(false);
      return;
    }

    // b) Find potential matches: teach_skill ↔ learn_skill
    const { data: candidates } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", userId)
      .eq("teach_skill", learnSkill)
      .eq("learn_skill", teachSkill);

    // c) Insert matches if not exists
    if (candidates && candidates.length > 0) {
      for (const other of candidates) {
        // Check duplicate
        const { data: existing } = await supabase
          .from("matches")
          .select("*")
          .or(`user1.eq.${userId},user2.eq.${userId}`)
          .eq("user1", other.id)
          .or(`user2.eq.${userId},user2.eq.${other.id}`);

        if (existing && existing.length > 0) continue;

        await supabase.from("matches").insert({
          user1: userId,
          user2: other.id,
          status: "pending",
        });
      }
    }

    setLoading(false);

    // d) Redirect to dashboard
    router.push("/dashboard");
  };

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Your Profile</h1>

      <div className="flex flex-col gap-4">
        <input
          className="border p-2 rounded"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="border p-2 rounded"
          placeholder="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />

        <input
          className="border p-2 rounded"
          placeholder="Teach Skill"
          value={teachSkill}
          onChange={(e) => setTeachSkill(e.target.value)}
        />

        <input
          className="border p-2 rounded"
          placeholder="Learn Skill"
          value={learnSkill}
          onChange={(e) => setLearnSkill(e.target.value)}
        />

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={handleSave}
        >
          {loading ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </main>
  );
}
