"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

function getAvatarDataUrl(name?: string | null) {
  const initial = (name || "U").trim().slice(0, 1).toUpperCase() || "U";
  const colors = ["#f7c7d9", "#b7e3ff", "#ffd8a8", "#c7f5d9", "#e2d4ff"];
  const colorIndex = initial.charCodeAt(0) % colors.length;
  const bg = colors[colorIndex];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" rx="48" ry="48" fill="${bg}"/><text x="50%" y="54%" text-anchor="middle" font-size="36" font-family="Arial, sans-serif" fill="#111">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function PublicProfilePage() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!id) return;

    async function fetchProfile() {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const accessToken = session.data?.session?.access_token;
      if (!accessToken) {
        setError("No access token. Please re-login.");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/profiles?ids=${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || res.statusText);
        setLoading(false);
        return;
      }

      const p = (json?.data as Profile[])?.[0] || null;
      setProfile(p);
      setError(null);
      setLoading(false);
    }

    fetchProfile();
  }, [id]);

  const handleRequestMatch = async () => {
    if (!profile?.id || !currentUserId || profile.id === currentUserId) return;
    const session = await supabase.auth.getSession();
    const accessToken = session.data?.session?.access_token;
    if (!accessToken) {
      setError("No access token. Please re-login.");
      return;
    }

    setRequesting(true);
    try {
      const res = await fetch("/api/matches/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ targetUserId: profile.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || "Error creating match request");
        return;
      }
    } finally {
      setRequesting(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-[radial-gradient(80rem_40rem_at_20%_-10%,#ffe8f2_0%,transparent_60%),radial-gradient(70rem_35rem_at_100%_0%,#dbeafe_0%,transparent_60%),linear-gradient(to_bottom,#fff7f8_0%,#f7fbff_100%)]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-black">Profile</h1>
            <p className="text-sm text-black/70">Skill-focused, modern, and clean.</p>
          </div>
          <div className="flex items-center gap-3">
            {currentUserId && profile?.id === currentUserId && (
              <Link
                href="/dashboard/profile"
                className="px-4 py-2 rounded-full bg-emerald-500 text-black text-sm shadow hover:bg-emerald-600"
              >
                Edit Profile
              </Link>
            )}
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-full border border-slate-200 bg-white/80 text-black text-sm shadow-sm hover:bg-white"
            >
              Back
            </Link>
          </div>
        </div>

        {loading && <p className="text-black">Loading...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && !profile && <p className="text-black">Profile not found.</p>}

        {profile && (
          <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={profile.avatar_url || getAvatarDataUrl(profile.name)}
                      alt={`${profile.name} avatar`}
                      className="h-14 w-14 rounded-2xl border border-pink-200 object-cover"
                    />
                    <span className="absolute -bottom-2 -right-2 h-5 w-5 rounded-full bg-emerald-400 border-2 border-white" />
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-black">{profile.name}</div>
                    <div className="text-sm text-black/70">
                      <span className="inline-flex flex-wrap gap-2">
                        {profile.teach_skill
                          ?.split(",")
                          .map(s => s.trim())
                          .filter(Boolean)
                          .map(s => (
                            <span key={`t-${s}`} className="px-2 py-0.5 rounded-full bg-slate-100 text-black text-xs">
                              Teach: {s}
                            </span>
                          ))}
                        {profile.learn_skill
                          ?.split(",")
                          .map(s => s.trim())
                          .filter(Boolean)
                          .map(s => (
                            <span key={`l-${s}`} className="px-2 py-0.5 rounded-full bg-slate-100 text-black text-xs">
                              Learn: {s}
                            </span>
                          ))}
                      </span>
                    </div>
                    {profile.hobby && (
                      <div className="text-xs text-black/60 mt-1">Hobby: {profile.hobby}</div>
                    )}
                    {profile.is_top_mentor && (
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-xs text-black">
                        Top Mentor
                      </div>
                    )}
                  </div>
                </div>

                {currentUserId && profile.id !== currentUserId && (
                  <button
                    className={`px-5 py-2.5 rounded-full text-sm shadow ${
                      requesting ? "bg-slate-300 text-black cursor-not-allowed" : "bg-black text-white hover:bg-slate-900"
                    }`}
                    onClick={handleRequestMatch}
                    disabled={requesting}
                  >
                    {requesting ? "Sending..." : "Request Match"}
                  </button>
                )}
                {currentUserId && profile.id === currentUserId && (
                  <span className="text-xs text-black/70">This is your profile</span>
                )}
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-black/60">Teach</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.teach_skill
                      ?.split(",")
                      .map(s => s.trim())
                      .filter(Boolean)
                      .map(s => (
                        <span key={`teach-${s}`} className="px-2 py-0.5 rounded-full bg-white text-xs text-black border border-slate-200">
                          {s}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-black/60">Learn</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.learn_skill
                      ?.split(",")
                      .map(s => s.trim())
                      .filter(Boolean)
                      .map(s => (
                        <span key={`learn-${s}`} className="px-2 py-0.5 rounded-full bg-white text-xs text-black border border-slate-200">
                          {s}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-black/60">Hobby</div>
                  <div className="text-sm font-medium text-black">{profile.hobby || "—"}</div>
                </div>
              </div>

              {(profile.availability_mode || profile.meeting_platform) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-black/60">Availability</div>
                    <div className="text-sm font-medium text-black">{profile.availability_mode || "—"}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-black/60">Platform</div>
                    <div className="text-sm font-medium text-black">{profile.meeting_platform || "—"}</div>
                  </div>
                </div>
              )}

              {(profile.github_url || profile.behance_url) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.github_url && (
                    <a
                      href={profile.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full bg-black text-white text-sm"
                    >
                      GitHub
                    </a>
                  )}
                  {profile.behance_url && (
                    <a
                      href={profile.behance_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full bg-slate-800 text-white text-sm"
                    >
                      Behance
                    </a>
                  )}
                </div>
              )}

              {profile.bio && (
                <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="text-xs uppercase tracking-wide text-black/60 mb-2">Bio</div>
                  <div className="text-sm text-black leading-relaxed">{profile.bio}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
