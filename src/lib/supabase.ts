/**
 * Altan Cloud (Supabase) Client Configuration
 * 
 * This file sets up the Supabase client for database operations and authentication.
 * It also defines TypeScript types for all database tables to ensure type safety.
 * 
 * @module supabase
 */

import { createClient } from '@supabase/supabase-js';

// Altan Cloud credentials
const supabaseUrl = 'https://eeaf921a-3e9.db-pool-europe-west1.altan.ai';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwNzkxMDgzMzUsImlhdCI6MTc2Mzc0ODMzNSwiaXNzIjoic3VwYWJhc2UiLCJyb2xlIjoiYW5vbiJ9.RA7N8UZVIpBwamYWQxcBkLMVMov0TNy8_cSfnBOBpXM';

/**
 * Supabase client instance
 * 
 * Configured with:
 * - Auto refresh tokens for seamless authentication
 * - Persistent sessions across page reloads
 * - Session detection from URL for OAuth flows
 * - Debug mode enabled for development
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
  debug: true,
});

/**
 * Database schema types
 * 
 * This interface represents the complete database schema with all tables,
 * their row types, insert types, and update types. Use these types for
 * all database operations to ensure type safety.
 * 
 * @example
 * ```typescript
 * import type { Event } from '@/lib/supabase'
 * 
 * const event: Event = {
 *   id: '123',
 *   user_id: '456',
 *   title: 'Meeting',
 *   // ... other fields
 * }
 * ```
 */
export interface Database {
  public: {
    Tables: {
      /**
       * User profiles table
       * Extends auth.users with additional user data
       * RLS enabled - users can read own profile and profiles of accepted relationships
       */
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          avatar_url: string | null;
          calendar_color: string;
          is_approved: boolean;
          approval_status: 'pending' | 'approved' | 'rejected';
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          email: string;
          avatar_url?: string | null;
          calendar_color?: string;
          is_approved?: boolean;
          approval_status?: 'pending' | 'approved' | 'rejected';
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          email?: string;
          avatar_url?: string | null;
          calendar_color?: string;
          is_approved?: boolean;
          approval_status?: 'pending' | 'approved' | 'rejected';
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      /**
       * Relationships table
       * Stores user relationships with status and timestamps
       * RLS enabled - users can read relationships where they are involved
       */
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
      /**
       * Events table
       * Stores calendar events with recurrence and metadata
       * RLS enabled - users can read events they own or are invited to
       */
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
          location: string | null;
          url: string | null;
          is_tentative: boolean;
          alerts: Record<string, any>[] | null;
          travel_time: string | null;
          original_calendar_id: string | null;
          attendees: Record<string, any>[] | null;
          structured_metadata: Record<string, any> | null;
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
          location?: string | null;
          url?: string | null;
          is_tentative?: boolean;
          alerts?: Record<string, any>[] | null;
          travel_time?: string | null;
          original_calendar_id?: string | null;
          attendees?: Record<string, any>[] | null;
          structured_metadata?: Record<string, any> | null;
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
          location?: string | null;
          url?: string | null;
          is_tentative?: boolean;
          alerts?: Record<string, any>[] | null;
          travel_time?: string | null;
          original_calendar_id?: string | null;
          attendees?: Record<string, any>[] | null;
          structured_metadata?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      /**
       * Event attendees table
       * Links users to events they are attending
       * RLS enabled - users can read attendees for events they own
       */
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