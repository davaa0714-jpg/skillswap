export interface Profile {
  id: string;
  name: string;
  bio: string;
  teach_skill: string;
  learn_skill: string;
  hobby?: string | null;
  avatar_url?: string | null;
  github_url?: string | null;
  behance_url?: string | null;
  availability_mode?: string | null;
  meeting_platform?: string | null;
  is_top_mentor?: boolean | null;
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
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: string;
  type: "match_request" | "system";
  message: string;
  match_id: number | null;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_avatar_url?: string | null;
  is_read: boolean;
  created_at: string;
}
