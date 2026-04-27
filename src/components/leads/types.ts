export const LEAD_STATUSES = [
  "New",
  "Interested",
  "Hot",
  "Paid",
  "Lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadWithContact {
  id: string;
  org_id: string;
  contact_id: string;
  name: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contact: {
    id: string;
    display_name: string | null;
    platform_user_id: string;
  } | null;
  latest_conversation_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
}
