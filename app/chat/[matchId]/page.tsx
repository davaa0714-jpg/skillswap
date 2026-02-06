"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/types";

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
  return {
    publicUrl: data.publicUrl,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

export default function ChatPage() {
  const params = useParams();
  const rawId = params?.matchId;
  const matchId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatFile, setChatFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!matchId) return;
    try {
      const draft = sessionStorage.getItem(`chatDraft:${matchId}`);
      if (draft) setText(draft);
    } catch {}

    let inFlight = false;
    async function fetchMessages() {
      if (inFlight) return;
      inFlight = true;
      const session = await supabase.auth.getSession();
      const accessToken = session.data?.session?.access_token;
      if (!accessToken) {
        setError("No access token. Please re-login.");
        inFlight = false;
        return;
      }
      const res = await fetch(`/api/messages?matchId=${matchId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to load messages");
        inFlight = false;
        return;
      }
      setError(null);
      setMessages((json?.data as Message[]) || []);
      inFlight = false;
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if ((!text.trim() && !chatFile) || !userId || !matchId) return;
    setSending(true);
    try {
      let filePayload = null;
      if (chatFile) {
        const uploaded = await uploadFile(chatFile, `messages/${matchId}`);
        filePayload = {
          fileUrl: uploaded.publicUrl,
          fileName: uploaded.fileName,
          fileType: uploaded.fileType,
          fileSize: uploaded.fileSize,
        };
      }
      const session = await supabase.auth.getSession();
      const accessToken = session.data?.session?.access_token;
      if (!accessToken) {
        setError("No access token. Please re-login.");
        return;
      }
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ matchId, text: text.trim(), ...filePayload }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to send message");
        return;
      }
      setError(null);
      setMessages(prev => [...prev, json.data as Message]);
      setText("");
      setChatFile(null);
      try {
        sessionStorage.removeItem(`chatDraft:${matchId}`);
      } catch {}
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-[radial-gradient(60rem_40rem_at_0%_0%,#fde2e2_0%,transparent_60%),radial-gradient(60rem_40rem_at_100%_0%,#dbeafe_0%,transparent_60%),linear-gradient(to_bottom,#fff5f5_0%,#eef6ff_100%)]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-black">Chat Room</h1>
            <div className="text-xs text-black">Match ID: {matchId || "—"}</div>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-black underline decoration-sky-300 underline-offset-2 hover:decoration-sky-500"
          >
            Back to Dashboard
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur shadow-lg">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm text-black">Say hi and start learning together.</p>
          </div>

          {error && <div className="px-4 pt-3 text-sm text-red-600">{error}</div>}
          <div className="h-[60vh] overflow-y-auto px-4 py-4 flex flex-col gap-2">
            {messages.length === 0 && (
              <div className="text-center text-sm text-black/70">
                No messages yet. Be the first to say hello.
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender === userId ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                    m.sender === userId
                      ? "bg-sky-500 text-black"
                      : "bg-rose-100 text-black"
                  }`}
                >
                  {m.text && <div className="mb-1">{m.text}</div>}
                  {m.file_url && m.file_type?.startsWith("image/") && (
                    <a href={m.file_url} target="_blank" rel="noreferrer">
                      <img src={m.file_url} alt={m.file_name || "Image"} className="max-w-[280px] rounded-lg border border-white/60" />
                    </a>
                  )}
                  {m.file_url && m.file_type?.startsWith("video/") && (
                    <a href={m.file_url} target="_blank" rel="noreferrer">
                      <video src={m.file_url} controls className="max-w-[320px] rounded-lg border border-white/60" />
                    </a>
                  )}
                  {m.file_url && !m.file_type?.startsWith("image/") && !m.file_type?.startsWith("video/") && (
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {m.file_name || "Download file"}
                    </a>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <input
                className="flex-1 border border-slate-200 p-2 rounded-full bg-white text-black placeholder:text-black/60 focus:outline-none focus:ring-2 focus:ring-pink-200"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={e => e.key === "Enter" && handleSend()}
              />
              <label className="px-3 py-2 rounded-full bg-white border border-slate-200 text-sm cursor-pointer">
                File
                <input
                  type="file"
                  className="hidden"
                  onChange={e => setChatFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                className={`px-4 rounded-full text-black shadow ${
                  sending || (!text.trim() && !chatFile)
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-600"
                }`}
                onClick={handleSend}
                disabled={sending || (!text.trim() && !chatFile)}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
            {chatFile && (
              <div className="mt-2 text-xs text-black">
                Selected: {chatFile.name} ({Math.ceil(chatFile.size / 1024)} KB)
                <button className="ml-2 underline" onClick={() => setChatFile(null)}>Remove</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
