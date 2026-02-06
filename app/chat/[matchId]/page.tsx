"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/types";

export default function ChatPage() {
  const params = useParams();
  const matchId = Number(params.matchId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        payload => setMessages(prev => [...prev, payload.new as Message])
      )
      .subscribe();

    supabase
      .from("messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true })
      .then(({ data }) => data && setMessages(data as Message[]));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text || !userId) return;
    await supabase.from("messages").insert({ match_id: matchId, sender: userId, text });
    setText("");
  };

  return (
    <main className="flex flex-col h-screen p-4">
      <div className="flex-1 overflow-y-auto border rounded p-2 mb-2 bg-gray-50">
        {messages.map(m => (
          <div key={m.id} className={`mb-1 flex ${m.sender === userId ? "justify-end" : "justify-start"}`}>
            <span className={`px-2 py-1 rounded inline-block ${m.sender === userId ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900"}`}>
              {m.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border p-2 rounded"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={e => e.key === "Enter" && handleSend()}
        />
        <button
          className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700"
          onClick={handleSend}
        >Send</button>
      </div>
    </main>
  );
}
