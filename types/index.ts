export interface Profile {
  id: string;
  name: string;
  bio: string;
  teach_skill: string;
  learn_skill: string;
}

export interface Match {
  id: number;
  user1: string;
  user2: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface Message {
  id: number;
  match_id: number;
  sender: string;
  text: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  type: "match_request" | "system";
  message: string;
  match_id: number | null;
  is_read: boolean;
  created_at: string;
}
