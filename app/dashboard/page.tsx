"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile, Match, Message, Notification } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

const MAX_FILE_SIZE = 30 * 1024 * 1024;

function getAvatarDataUrl(name?: string | null) {
  const initial = (name || "U").trim().slice(0, 1).toUpperCase() || "U";
  const colors = ["#f7c7d9", "#b7e3ff", "#ffd8a8", "#c7f5d9", "#e2d4ff"];
  const colorIndex = initial.charCodeAt(0) % colors.length;
  const bg = colors[colorIndex];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" rx="24" ry="24" fill="${bg}"/><text x="50%" y="54%" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="#111">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function uploadFile(file: File, pathPrefix: string) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File is too large. Max 30MB.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const filePath = `${pathPrefix}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("uploads").upload(filePath, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("uploads").getPublicUrl(filePath);
  return {
    publicUrl: data.publicUrl,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

function uniqById<T extends { id: string | number }>(items: T[]) {
  return Array.from(new Map(items.map(item => [item.id, item])).values());
}

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [otherUsers, setOtherUsers] = useState<Profile[]>([]);
  const [otherUsersError, setOtherUsersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatSending, setChatSending] = useState(false);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // Fetch dashboard
  useEffect(() => {
    if (!userId) return;

    async function fetchDashboard() {
      setLoading(true);
      try {
        const session = await supabase.auth.getSession();
        const accessToken = session.data?.session?.access_token;
        if (!accessToken) {
          setLoading(false);
          return;
        }

        const matchRes = await fetch("/api/matches", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const matchJson = await matchRes.json();
        if (!matchRes.ok) {
          console.error("Error fetching matches:", matchJson?.error || matchRes.statusText);
          setMatchesError(matchJson?.error || matchRes.statusText);
          setMatches([]);
          setLoading(false);
          return;
        }

        const matchData = (matchJson?.data as Match[]) || [];
        setMatches(uniqById(matchData));
        setMatchesError(null);

        const matchIds = matchData?.map(m => [m.user1, m.user2]).flat() || [];
        const profileIds = Array.from(new Set([...matchIds, userId]));

        if (accessToken) {
            const resProfiles = await fetch(`/api/profiles?ids=${profileIds.join(",")}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
          const jsonProfiles = await resProfiles.json();
          if (resProfiles.ok) {
            const profileMap: Record<string, Profile> = {};
            (jsonProfiles.data || []).forEach((p: Profile) => (profileMap[p.id] = p));
            setProfiles(profileMap);
          } else {
            console.error("Error fetching profiles for matches:", jsonProfiles?.error || resProfiles.statusText);
          }
        }

        // Other Users + Notifications
        const accessToken2 = accessToken;
        if (accessToken2) {
          const res = await fetch(`/api/profiles?exclude=${userId}`, {
            headers: { Authorization: `Bearer ${accessToken2}` },
          });
          const json = await res.json();
          if (res.ok) setOtherUsers(json.data || []);
          else setOtherUsersError(json.error || res.statusText);

          const nRes = await fetch(`/api/notifications`, {
            headers: { Authorization: `Bearer ${accessToken2}` },
          });
          const nJson = await nRes.json();
          if (nRes.ok) setNotifications(uniqById(nJson.data || []));
          else setNotificationsError(nJson.error || nRes.statusText);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }

    fetchDashboard();
  }, [userId]);

  // Request match
  const handleRequestMatch = async (targetId: string) => {
    if (!userId) return;
    const session = await supabase.auth.getSession();
    const accessToken = session.data?.session?.access_token;
    if (!accessToken) {
      alert("No access token. Please re-login.");
      return;
    }

    const res = await fetch("/api/matches/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ targetUserId: targetId }),
    });

    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Error creating match");
      return;
    }

    const inserted = json?.data as Match;
    setMatches(prev => uniqById([...prev, inserted]));
  };

  // Inline chat fetch + realtime
  useEffect(() => {
    if (!activeMatchId) return;

    let isMounted = true;
    let inFlight = false;

    async function fetchMessages() {
      if (inFlight) return;
      inFlight = true;
      const session = await supabase.auth.getSession();
      const accessToken = session.data?.session?.access_token;
      if (!accessToken) {
        setChatError("No access token. Please re-login.");
        inFlight = false;
        return;
      }

      const res = await fetch(`/api/messages?matchId=${activeMatchId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setChatError(json?.error || "Failed to load messages");
        inFlight = false;
        return;
      }
      if (isMounted) {
        setChatError(null);
        setMessages((json?.data as Message[]) || []);
      }
      inFlight = false;
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeMatchId]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !chatFile) || !userId || !activeMatchId) return;
    const session = await supabase.auth.getSession();
    const accessToken = session.data?.session?.access_token;
    if (!accessToken) {
      setChatError("No access token. Please re-login.");
      return;
    }

    setChatSending(true);
    try {
      let filePayload = null;
      if (chatFile) {
        const uploaded = await uploadFile(chatFile, `messages/${activeMatchId}`);
        filePayload = {
          fileUrl: uploaded.publicUrl,
          fileName: uploaded.fileName,
          fileType: uploaded.fileType,
          fileSize: uploaded.fileSize,
        };
      }

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          matchId: activeMatchId,
          text: newMessage.trim(),
          ...filePayload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setChatError(json?.error || "Failed to send");
        return;
      }

      setChatError(null);
      setMessages(prev => [...prev, json.data as Message]);
      setNewMessage("");
      setChatFile(null);
    } catch (err: any) {
      setChatError(err?.message || "Failed to upload file");
    } finally {
      setChatSending(false);
    }
  };

  const refreshMatches = async () => {
    if (!userId) return;
    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .or(`user1.eq.${userId},user2.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (matchData) setMatches(uniqById(matchData));
  };

  const refreshNotifications = async (accessToken: string) => {
    const nRes = await fetch(`/api/notifications`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const nJson = await nRes.json();
    if (nRes.ok) setNotifications(uniqById(nJson.data || []));
    else setNotificationsError(nJson.error || nRes.statusText);
  };

  const handleResolveNotification = async (notificationId: number, action: "accept" | "reject", matchId?: number | null) => {
    const session = await supabase.auth.getSession();
    const accessToken = session.data?.session?.access_token;
    if (!accessToken) {
      alert("No access token. Please re-login.");
      return;
    }

    const res = await fetch("/api/notifications/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ notificationId, action }),
    });

    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to resolve notification");
      return;
    }

    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    if (action === "accept") {
      const acceptedId = json?.match?.id || matchId || null;
      if (acceptedId) {
        setMatches(prev => prev.map(m => (m.id === acceptedId ? { ...m, status: "accepted" } : m)));
      }
    }
    if (action === "reject" && json?.matchId) {
      setMatches(prev => prev.filter(m => m.id !== json.matchId));
      if (activeMatchId === json.matchId) setActiveMatchId(null);
    }

    await refreshMatches();
    await refreshNotifications(accessToken);
    alert(action === "accept" ? "Match accepted!" : "Match rejected!");
  };

  if (loading) return <p className="p-6 text-black">Loading...</p>;

  return (
    <main className="min-h-screen p-6 bg-gradient-to-b from-rose-50 via-pink-50 to-sky-50">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-6 text-black tracking-tight">Dashboard</h1>

      {/* Own Profile */}
      {userId && profiles[userId] && (
        <div className="mb-6 p-4 rounded-2xl bg-white/90 backdrop-blur border border-pink-100 shadow-md flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <Link href={`/profile/${userId}`} className="inline-flex">
                <img
                  src={profiles[userId].avatar_url || getAvatarDataUrl(profiles[userId].name)}
                  alt={`${profiles[userId].name} avatar`}
                  className="h-10 w-10 rounded-full border border-pink-200"
                />
              </Link>
              <div className="text-lg font-semibold text-black">{profiles[userId].name}</div>
            </div>
            <div className="text-sm text-black">
              Teach: <span className="font-medium text-black">{profiles[userId].teach_skill}</span> · Learn:{" "}
              <span className="font-medium text-black">{profiles[userId].learn_skill}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded-full text-black text-sm shadow ${
                matches.some(m => m.status === "accepted")
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-slate-300 cursor-not-allowed"
              }`}
              onClick={() => {
                const firstAccepted = matches.find(m => m.status === "accepted");
                if (firstAccepted) setActiveMatchId(firstAccepted.id);
              }}
              disabled={!matches.some(m => m.status === "accepted")}
            >
              Start Chat
            </button>
            {userId && (
              <Link href={`/profile/${userId}`} className="px-3 py-1.5 bg-sky-500 text-black rounded-full text-sm shadow hover:bg-sky-600">
                Profile
              </Link>
            )}
          </div>
        </div>
      )}
      {matchesError && (
        <p className="mb-4 text-sm text-red-600">Matches error: {matchesError}</p>
      )}

      {/* Other Users */}
      <div className="mb-6 rounded-2xl bg-white/90 backdrop-blur border border-pink-100 shadow-md p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-semibold text-black">Other Users</h2>
          <input
            className="w-64 max-w-full border border-slate-200 rounded-full px-3 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-pink-200"
            placeholder="Search skill or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {otherUsersError && <p className="text-red-600">{otherUsersError}</p>}
        <ul>
          {otherUsers
            .filter(u => {
              const q = searchQuery.trim().toLowerCase();
              if (!q) return true;
              return (
                u.name?.toLowerCase().includes(q) ||
                u.teach_skill?.toLowerCase().includes(q) ||
                u.learn_skill?.toLowerCase().includes(q)
              );
            })
            .map(u => (
            <li key={u.id} className="mb-2 p-3 border border-slate-100 rounded-xl flex justify-between items-center bg-white shadow-sm">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${u.id}`} className="inline-flex">
                  <img
                    src={u.avatar_url || getAvatarDataUrl(u.name)}
                    alt={`${u.name} avatar`}
                    className="h-9 w-9 rounded-full border border-pink-200"
                  />
                </Link>
                <div>
                  <Link href={`/profile/${u.id}`} className="font-semibold text-black hover:underline">
                    {u.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-black">
                    {u.teach_skill
                      ?.split(",")
                      .map(s => s.trim())
                      .filter(Boolean)
                      .map(s => (
                        <span key={`t-${u.id}-${s}`} className="px-2 py-0.5 rounded-full bg-slate-100">Teach: {s}</span>
                      ))}
                    {u.learn_skill
                      ?.split(",")
                      .map(s => s.trim())
                      .filter(Boolean)
                      .map(s => (
                        <span key={`l-${u.id}-${s}`} className="px-2 py-0.5 rounded-full bg-slate-100">Learn: {s}</span>
                      ))}
                  </div>
                </div>
              </div>
              <button
                className="px-4 py-1.5 bg-pink-500 text-black rounded-full text-sm shadow hover:bg-pink-600"
                onClick={() => handleRequestMatch(u.id)}
              >Request Match</button>
            </li>
          ))}
        </ul>
      </div>

      {/* Notifications */}
      <div className="mb-6 rounded-2xl bg-white/90 backdrop-blur border border-pink-100 shadow-md p-4">
        <h2 className="text-xl font-semibold mb-3 text-black">Notifications</h2>
        {notificationsError && <p className="text-red-600">{notificationsError}</p>}
        {notifications.length === 0 ? (
          <p className="text-sm text-black">No notifications yet.</p>
        ) : (
          <ul>
            {notifications.map(n => (
              <li key={`${n.id}-${n.created_at}`} className="mb-2 p-3 border border-slate-100 rounded-xl bg-white shadow-sm">
                <div className="text-xs text-black">{new Date(n.created_at).toLocaleString()}</div>
                {(n.sender_name || n.sender_id) && (
                  <div className="mt-1 flex items-center gap-2 text-sm text-black">
                    <Link href={`/profile/${n.sender_id}`} className="inline-flex">
                      <img
                        src={n.sender_avatar_url || getAvatarDataUrl(n.sender_name || n.sender_id)}
                        alt={n.sender_name ? `${n.sender_name} avatar` : "User avatar"}
                        className="h-6 w-6 rounded-full border border-pink-200"
                      />
                    </Link>
                    <span>
                      From:{" "}
                      {n.sender_id ? (
                        <Link
                          href={`/profile/${n.sender_id}`}
                          className="font-medium text-black underline decoration-pink-300 underline-offset-2 hover:decoration-pink-500"
                        >
                          {n.sender_name || `User ${n.sender_id.slice(0, 6)}…`}
                        </Link>
                      ) : (
                        n.sender_name
                      )}
                    </span>
                  </div>
                )}
                <div className={n.is_read ? "text-black" : "font-semibold text-black"}>{n.message}</div>
                {n.type === "match_request" && !n.is_read && (
                  <div className="mt-2 flex gap-2">
                    <button
                      className="px-3 py-1.5 bg-emerald-500 text-black rounded-full text-sm shadow hover:bg-emerald-600"
                      onClick={() => handleResolveNotification(n.id, "accept", n.match_id)}
                    >
                      Accept
                    </button>
                    <button
                      className="px-3 py-1.5 bg-rose-500 text-black rounded-full text-sm shadow hover:bg-rose-600"
                      onClick={() => handleResolveNotification(n.id, "reject", n.match_id)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Matches */}
      <div className="rounded-2xl bg-white/90 backdrop-blur border border-pink-100 shadow-md p-4">
        <h2 className="text-xl font-semibold mb-3 text-black">Matches</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-black">No matches yet.</p>
        ) : (
          <ul>
            {matches.map(m => {
              const otherId = m.user1 === userId ? m.user2 : m.user1;
              const profile = profiles[otherId];
              const displayName = profile?.name || `User ${otherId.slice(0, 6)}…`;
              const canChat = m.status === "accepted";
              const isActive = activeMatchId === m.id;
              return (
                <li
                  key={`${m.id}-${m.user1}-${m.user2}`}
                  className={`mb-2 p-3 border border-slate-100 rounded-xl ${canChat ? "cursor-pointer" : "bg-white shadow-sm"} ${isActive ? "border-sky-300 bg-sky-50" : ""}`}
                  onClick={() => canChat && setActiveMatchId(m.id)}
                >
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={profile?.avatar_url || getAvatarDataUrl(displayName)}
                        alt={`${displayName} avatar`}
                        className="h-8 w-8 rounded-full border border-pink-200"
                      />
                      <span>
                        <Link href={`/profile/${otherId}`} className="text-black hover:underline">
                          {displayName}
                        </Link>{" "}
                        |{" "}
                        <span className={`capitalize font-semibold ${m.status === "accepted" ? "text-emerald-600" : "text-black"}`}>
                          {m.status === "accepted" ? "Matched" : m.status}
                        </span>
                      </span>
                    </div>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500 text-black">Active</span>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        className={`px-3 py-1.5 rounded-full text-sm ${
                          canChat
                            ? "bg-emerald-500 text-black hover:bg-emerald-600"
                            : "bg-slate-300 text-black cursor-not-allowed"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canChat) return;
                          router.push(`/chat/${m.id}`);
                        }}
                        disabled={!canChat}
                      >
                        {canChat ? "Open Chat" : "Start Chat"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
    </main>
  );
}



