"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

export default function MatchPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1️⃣ Current user ID авах
  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error(error);
      if (data.user) setCurrentUserId(data.user.id);
    }
    fetchUser();
  }, []);

  // 2️⃣ Other profiles авах
  useEffect(() => {
    if (!currentUserId) return;

    async function fetchMatches() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", currentUserId);

      if (error) console.error(error);
      else setProfiles(data || []);
    }

    fetchMatches();
  }, [currentUserId]);

  // 3️⃣ Handle skill swap request
  async function handleRequest(recipientId: string) {
    if (!currentUserId) return;

    const { error } = await supabase
      .from("requests")
      .insert({
        sender_id: currentUserId,
        recipient_id: recipientId,
        status: "pending",
      });

    if (error) {
      console.error("Error creating request:", error);
      alert("Failed to send request");
    } else {
      alert("Request sent!");
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Find a Match</h1>

      {profiles.length === 0 && <p>No matches yet...</p>}

      <ul>
        {profiles.map((p) => (
          <li
            key={p.id}
            className="mb-2 p-2 border rounded flex justify-between items-center"
          >
            <div>
              <strong>{p.name}</strong> | Teach: {p.teach_skill} | Learn: {p.learn_skill}
            </div>
            <button
  className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
  onClick={() => handleRequest(p.id)}
>
  Request
</button>

          </li>
        ))}
      </ul>
    </main>
  );
}
