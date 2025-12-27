import axios from 'axios';

// Environment variable for API URL (Render/Local)
const envUrl = import.meta.env.VITE_API_URL;
const API_URL = envUrl ? (envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`) : 'http://localhost:3000/api';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add Auth Token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 (Unauthorized) - Redirect to login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // If 401 and NOT from the login endpoint itself (to avoid loop/refresh on failed login)
        if (error.response?.status === 401 && !error.config.url?.includes('/auth/login')) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Type definitions to match what Supabase returned effectively
export interface User {
    id: string;
    email: string;
    display_name: string;
    passwordHash?: string;
    avatar_url?: string;
    calendar_color: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface Event {
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
    attendees: string[] | null;
    structured_metadata: Record<string, any> | null;
    created_at: string;
    updated_at: string;
}

export interface EventWithAttendees extends Event {
    attendees: any[]; // IDs
    attendees_details?: { userId: string; status: 'pending' | 'accepted' | 'declined' }[];
    viewers?: string[];
    creator_name?: string;
    creator_color?: string;
    isViewer?: boolean;
}

// Database Types (Migrated from supabase.ts)
export interface Profile {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string | null;
    calendar_color: string;
    is_approved: boolean;
    approval_status: 'pending' | 'approved' | 'rejected';
    approved_at?: string | null;
    approved_by?: string | null;
    created_at: string;
    updated_at: string;
}

export interface Relationship {
    id: string;
    user_id: string;
    related_user_id: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
    updated_at: string;
}

export interface EventAttendee {
    id: string;
    event_id: string;
    user_id: string;
    is_attendee: boolean;
    status: 'pending' | 'accepted' | 'declined';
    created_at: string;
}

export interface EventViewer {
    id: string;
    event_id: string;
    user_id: string;
    created_at: string;
}

// Travel Location (World Map Feature)
export interface TravelLocation {
    id: string;
    userId: string;
    name: string;
    latitude: string;
    longitude: string;
    country?: string | null;
    city?: string | null;
    visitedDate?: string | null;
    withRelationshipId?: string | null;
    isWishlist: boolean;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
    // Enriched fields from backend
    isOwn?: boolean;
    ownerName?: string;
    ownerColor?: string;
    withRelationshipName?: string | null;
}
