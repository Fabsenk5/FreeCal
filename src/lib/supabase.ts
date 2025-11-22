import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eeaf921a-3e9.db-pool-europe-west1.altan.ai';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwNzkxMDgzMzUsImlhdCI6MTc2Mzc0ODMzNSwiaXNzIjoic3VwYWJhc2UiLCJyb2xlIjoiYW5vbiJ9.RA7N8UZVIpBwamYWQxcBkLMVMov0TNy8_cSfnBOBpXM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          avatar_url: string | null;
          calendar_color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          email: string;
          avatar_url?: string | null;
          calendar_color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          email?: string;
          avatar_url?: string | null;
          calendar_color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      relationships: {
        Row: {
          id: string;
          user_id: string;
          related_user_id: string;
          status: 'pending' | 'accepted' | 'rejected';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          related_user_id: string;
          status?: 'pending' | 'accepted' | 'rejected';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          related_user_id?: string;
          status?: 'pending' | 'accepted' | 'rejected';
          created_at?: string;
          updated_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string;
          is_all_day: boolean;
          color: string;
          recurrence_rule: string | null;
          recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
          recurrence_days: string[] | null;
          recurrence_interval: number | null;
          recurrence_end_date: string | null;
          imported_from_device: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          start_time: string;
          end_time: string;
          is_all_day?: boolean;
          color: string;
          recurrence_rule?: string | null;
          recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
          recurrence_days?: string[] | null;
          recurrence_interval?: number | null;
          recurrence_end_date?: string | null;
          imported_from_device?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          start_time?: string;
          end_time?: string;
          is_all_day?: boolean;
          color?: string;
          recurrence_rule?: string | null;
          recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
          recurrence_days?: string[] | null;
          recurrence_interval?: number | null;
          recurrence_end_date?: string | null;
          imported_from_device?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_attendees: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Relationship = Database['public']['Tables']['relationships']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type EventAttendee = Database['public']['Tables']['event_attendees']['Row'];
