"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [teachSkill, setTeachSkill] = useState("");
  const [learnSkill, setLearnSkill] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);

    // 1️⃣ Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      alert("Error creating user: " + authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      alert("User not created");
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    // 2️⃣ Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      name,
      bio,
      teach_skill: teachSkill,
      learn_skill: learnSkill,
    });

    if (profileError) {
      alert("Error creating profile: " + profileError.message);
      setLoading(false);
      return;
    }

    // 3️⃣ Redirect to dashboard
    router.push("/dashboard");
  };

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <div className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          placeholder="Name"
          className="border p-2 rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Bio"
          className="border p-2 rounded"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <input
          placeholder="Teach Skill"
          className="border p-2 rounded"
          value={teachSkill}
          onChange={(e) => setTeachSkill(e.target.value)}
        />
        <input
          placeholder="Learn Skill"
          className="border p-2 rounded"
          value={learnSkill}
          onChange={(e) => setLearnSkill(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </div>
    </main>
  );
}
