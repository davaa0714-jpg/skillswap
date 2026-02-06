"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile, Match, Message, Notification } from "@/types";
import Link from "next/link";

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [otherUsers, setOtherUsers] = useState<Profile[]>([]);
  const [otherUsersError, setOtherUsersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);

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
        setMatches(matchData);
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
          if (nRes.ok) setNotifications(nJson.data || []);
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
    setMatches(prev => [...prev, inserted]);
  };

  // Inline chat fetch + realtime
  useEffect(() => {
    if (!activeMatchId) return;

    let isMounted = true;

    async function fetchMessages() {
      const session = await supabase.auth.getSession();
      const accessToken = session.data?.session?.access_token;
      if (!accessToken) {
        setChatError("No access token. Please re-login.");
        return;
      }

      const res = await fetch(`/api/messages?matchId=${activeMatchId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setChatError(json?.error || "Failed to load messages");
        return;
      }
      if (isMounted) {
        setChatError(null);
        setMessages((json?.data as Message[]) || []);
      }
    }

    fetchMessages();

    return () => {
      isMounted = false;
    };
  }, [activeMatchId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !userId || !activeMatchId) return;
    const session = await supabase.auth.getSession();
    const accessToken = session.data?.session?.access_token;
    if (!accessToken) {
      setChatError("No access token. Please re-login.");
      return;
    }

    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ matchId: activeMatchId, text: newMessage.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setChatError(json?.error || "Failed to send");
      return;
    }

    setChatError(null);
    setMessages(prev => [...prev, json.data as Message]);
    setNewMessage("");
  };

  const refreshMatches = async () => {
    if (!userId) return;
    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .or(`user1.eq.${userId},user2.eq.${userId}`)
      .order("created_at", { ascending: false });
    setMatches(matchData || []);
  };

  const refreshNotifications = async (accessToken: string) => {
    const nRes = await fetch(`/api/notifications`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const nJson = await nRes.json();
    if (nRes.ok) setNotifications(nJson.data || []);
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

    setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n)));

    if (action === "accept" && json?.match?.id) {
      setMatches(prev => prev.map(m => (m.id === json.match.id ? { ...m, status: "accepted" } : m)));
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
            <div className="text-lg font-semibold text-black">{profiles[userId].name}</div>
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
            <Link href="/dashboard/profile" className="px-3 py-1.5 bg-sky-500 text-black rounded-full text-sm shadow hover:bg-sky-600">
              Edit Profile
            </Link>
          </div>
        </div>
      )}
      {matchesError && (
        <p className="mb-4 text-sm text-red-600">Matches error: {matchesError}</p>
      )}

      {/* Other Users */}
      <div className="mb-6 rounded-2xl bg-white/90 backdrop-blur border border-pink-100 shadow-md p-4">
        <h2 className="text-xl font-semibold mb-3 text-black">Other Users</h2>
        {otherUsersError && <p className="text-red-600">{otherUsersError}</p>}
        <ul>
          {otherUsers.map(u => (
            <li key={u.id} className="mb-2 p-3 border border-slate-100 rounded-xl flex justify-between items-center bg-white shadow-sm">
              <div>
                <div className="font-semibold text-black">{u.name}</div>
                <div className="text-sm text-black">
                  Teach: <span className="font-medium text-black">{u.teach_skill}</span> · Learn:{" "}
                  <span className="font-medium text-black">{u.learn_skill}</span>
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
              <li key={n.id} className="mb-2 p-3 border border-slate-100 rounded-xl bg-white shadow-sm">
                <div className="text-xs text-black">{new Date(n.created_at).toLocaleString()}</div>
                <div className={n.is_read ? "text-black" : "font-semibold text-black"}>{n.message}</div>
                {n.type === "match_request" && (
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

      {/* Chat (Prominent) */}
      <div className="mb-6 rounded-2xl border border-sky-100 p-4 bg-white/90 backdrop-blur shadow-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-black">
            Chat
            {activeMatchId && (() => {
              const active = matches.find(m => m.id === activeMatchId);
              const otherId = active ? (active.user1 === userId ? active.user2 : active.user1) : null;
              const name = otherId ? (profiles[otherId]?.name || `User ${otherId.slice(0, 6)}…`) : null;
              return name ? <span className="ml-2 text-sm text-black">with {name}</span> : null;
            })()}
          </h2>
          {activeMatchId && (
            <span className="text-xs text-black">
              Match ID: {activeMatchId}
            </span>
          )}
        </div>
        {activeMatchId ? (
          <>
            {chatError && <p className="text-sm text-red-600 mb-2">{chatError}</p>}
            <div className="h-64 overflow-y-auto mb-2 flex flex-col gap-2 border border-slate-100 rounded-xl p-3 bg-slate-50">
              {messages.map(msg => (
                <div key={msg.id} className={`px-3 py-2 rounded-2xl text-sm text-black ${msg.sender === userId ? "bg-sky-200 self-end" : "bg-rose-100 self-start"}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 p-2 rounded-full bg-white text-black placeholder:text-black focus:outline-none focus:ring-2 focus:ring-pink-200"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              />
              <button
                className="bg-sky-500 text-black px-4 rounded-full shadow hover:bg-sky-600"
                onClick={handleSendMessage}
              >Send</button>
            </div>
          </>
        ) : (
          <p className="text-sm text-black">Matches хэсгээс “Start Chat” дарж эхлүүл.</p>
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
                  key={m.id}
                  className={`mb-2 p-3 border border-slate-100 rounded-xl ${canChat ? "cursor-pointer" : "bg-white shadow-sm"} ${isActive ? "border-sky-300 bg-sky-50" : ""}`}
                  onClick={() => canChat && setActiveMatchId(m.id)}
                >
                  <div className="flex justify-between items-center gap-4">
                    <span>
                      {displayName} |{" "}
                      <span className={`capitalize font-semibold ${m.status === "accepted" ? "text-emerald-600" : "text-black"}`}>
                        {m.status === "accepted" ? "Matched" : m.status}
                      </span>
                    </span>
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
                          if (canChat) setActiveMatchId(m.id);
                        }}
                        disabled={!canChat}
                      >
                        Start Chat
                      </button>
                      {canChat ? (
                        <Link href={`/chat/${m.id}`} className="text-black hover:underline text-sm">Open Chat Page</Link>
                      ) : (
                        <span className="text-xs text-black">Accept хийсний дараа chat нээгдэнэ</span>
                      )}
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



