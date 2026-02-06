"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

const MAX_FILE_SIZE = 30 * 1024 * 1024;

async function uploadFile(file: File, pathPrefix: string) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File is too large. Max 30MB.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const filePath = `${pathPrefix}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("uploads").upload(filePath, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("uploads").getPublicUrl(filePath);
  return data.publicUrl;
}

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [hobby, setHobby] = useState("");
  const [teachSkills, setTeachSkills] = useState<string[]>([]);
  const [learnSkills, setLearnSkills] = useState<string[]>([]);
  const [teachInput, setTeachInput] = useState("");
  const [learnInput, setLearnInput] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [behanceUrl, setBehanceUrl] = useState("");
  const [availabilityMode, setAvailabilityMode] = useState("online");
  const [meetingPlatform, setMeetingPlatform] = useState("Zoom");
  const [isTopMentor, setIsTopMentor] = useState(false);

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
        setHobby(data.hobby || "");
        setTeachSkills(
          (data.teach_skill || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        );
        setLearnSkills(
          (data.learn_skill || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        );
        setAvatarUrl(data.avatar_url || null);
        setGithubUrl(data.github_url || "");
        setBehanceUrl(data.behance_url || "");
        setAvailabilityMode(data.availability_mode || "online");
        setMeetingPlatform(data.meeting_platform || "Zoom");
        setIsTopMentor(Boolean(data.is_top_mentor));
      }
      setLoading(false);
    }

    fetchProfile();
  }, [userId]);

  useEffect(() => {
    if (!avatarFile || !avatarFile.type.startsWith("image/")) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  // 3️⃣ Save profile + create matches
  const handleSave = async () => {
    if (!userId) return;

    setLoading(true);
    let finalAvatarUrl = avatarUrl;
    try {
      if (avatarFile) {
        finalAvatarUrl = await uploadFile(avatarFile, `profiles/${userId}`);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to upload file");
      setLoading(false);
      return;
    }

    // a) Save / upsert profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      name,
      bio,
      hobby,
      teach_skill: teachSkills.join(", "),
      learn_skill: learnSkills.join(", "),
      avatar_url: finalAvatarUrl,
      github_url: githubUrl || null,
      behance_url: behanceUrl || null,
      availability_mode: availabilityMode || null,
      meeting_platform: meetingPlatform || null,
      is_top_mentor: isTopMentor,
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
      .eq("teach_skill", learnSkills.join(", "))
      .eq("learn_skill", teachSkills.join(", "));

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
    <main className="min-h-screen p-6 bg-[radial-gradient(60rem_40rem_at_0%_0%,#fde2e2_0%,transparent_60%),radial-gradient(60rem_40rem_at_100%_0%,#dbeafe_0%,transparent_60%),linear-gradient(to_bottom,#fff5f5_0%,#eef6ff_100%)]">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-black">Profile</h1>
            <p className="text-sm text-black/70">Skills only. No personal details.</p>
          </div>
          <button
            className="px-4 py-2 rounded-full bg-emerald-500 text-black shadow hover:bg-emerald-600"
            onClick={handleSave}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <img
              src={avatarPreview || avatarUrl || undefined}
              alt="Avatar"
              className="h-16 w-16 rounded-full border border-slate-200 bg-slate-100 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "";
              }}
            />
            <div className="flex items-center gap-2">
              <label className="px-3 py-2 rounded-full bg-white border border-slate-200 text-sm cursor-pointer">
                Upload File
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />
              </label>
              {avatarFile && (
                <button className="text-sm underline" onClick={() => setAvatarFile(null)}>
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-black/60">Display Name</label>
              <input
                className="mt-1 w-full border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-black/60">Teach Skill</label>
              <div className="mt-1 flex gap-2">
                <input
                  className="flex-1 border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                  placeholder="Add a skill"
                  value={teachInput}
                  onChange={(e) => setTeachInput(e.target.value)}
                />
                <button
                  className="px-3 rounded-lg bg-slate-900 text-white"
                  onClick={() => {
                    const v = teachInput.trim();
                    if (!v) return;
                    setTeachSkills(prev => (prev.includes(v) ? prev : [...prev, v]));
                    setTeachInput("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {teachSkills.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-xs text-black">
                    {s}
                    <button className="text-black/60" onClick={() => setTeachSkills(prev => prev.filter(x => x !== s))}>×</button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-black/60">Learn Skill</label>
              <div className="mt-1 flex gap-2">
                <input
                  className="flex-1 border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                  placeholder="Add a skill"
                  value={learnInput}
                  onChange={(e) => setLearnInput(e.target.value)}
                />
                <button
                  className="px-3 rounded-lg bg-slate-900 text-white"
                  onClick={() => {
                    const v = learnInput.trim();
                    if (!v) return;
                    setLearnSkills(prev => (prev.includes(v) ? prev : [...prev, v]));
                    setLearnInput("");
                  }}
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {learnSkills.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-xs text-black">
                    {s}
                    <button className="text-black/60" onClick={() => setLearnSkills(prev => prev.filter(x => x !== s))}>×</button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-black/60">Availability</label>
              <select
                className="mt-1 w-full border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                value={availabilityMode}
                onChange={(e) => setAvailabilityMode(e.target.value)}
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-black/60">Platform</label>
              <select
                className="mt-1 w-full border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                value={meetingPlatform}
                onChange={(e) => setMeetingPlatform(e.target.value)}
              >
                <option value="Zoom">Zoom</option>
                <option value="Google Meet">Google Meet</option>
                <option value="Teams">Teams</option>
                <option value="Discord">Discord</option>
                <option value="In-person">In-person</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-black/60">Hobby</label>
              <input
                className="mt-1 w-full border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                placeholder="Your hobbies"
                value={hobby}
                onChange={(e) => setHobby(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-black/60">GitHub</label>
              <input
                className="mt-1 w-full border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                placeholder="https://github.com/username"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-black/60">Behance</label>
              <input
                className="mt-1 w-full border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                placeholder="https://behance.net/username"
                value={behanceUrl}
                onChange={(e) => setBehanceUrl(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-wide text-black/60">Bio</label>
              <textarea
                className="mt-1 w-full border border-slate-200 p-2 rounded-lg bg-white text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                placeholder="Short bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-black">
                <input
                  type="checkbox"
                  checked={isTopMentor}
                  onChange={(e) => setIsTopMentor(e.target.checked)}
                />
                Top Mentor
              </label>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
